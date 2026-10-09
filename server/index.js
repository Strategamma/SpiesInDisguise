import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { addPlayer, chooseOffer, newPlayer, newRoom, restart, roomCode, setReady, startGame, submitOffer, swapCard, viewFor } from "./game.js";

const processStartedAt = Date.now();
const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const rooms = new Map();
const port = Number(process.env.PORT || 3000);
const maxRooms = Math.max(1, Number(process.env.MAX_ROOMS || 1000));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const metrics = { httpRequests: 0, websocketConnections: 0, websocketErrors: 0, websocketCloses: 0, messageErrors: 0, roomsCreated: 0, roomCreationFailures: 0, roomsExpired: 0 };
let startupDurationMs = null;

function log(event, details = {}) { console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, ...details })); }
function healthSnapshot() {
  return {
    ok: true,
    version: (process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "development").slice(0, 12),
    startedAt: new Date(processStartedAt).toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    startupDurationMs,
    activeRooms: rooms.size,
    roomCapacity: maxRooms,
    activeWebSockets: wss?.clients?.size || 0,
    counters: { ...metrics }
  };
}

const server = http.createServer(async (req, res) => {
  metrics.httpRequests += 1;
  if (req.url === "/health") { res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); return res.end(JSON.stringify(healthSnapshot())); }
  const path = normalize(decodeURIComponent(new URL(req.url, "http://local").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, path === "/" ? "index.html" : path);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }
  try { const data = await readFile(file); res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": extname(file) === ".html" ? "no-cache" : "public, max-age=3600" }); res.end(data); }
  catch { try { const data = await readFile(join(root, "index.html")); res.writeHead(200, { "content-type": types[".html"] }); res.end(data); } catch { res.writeHead(404); res.end("Not found"); } }
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });

function emit(ws, message) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); }
function update(room) { room.players.forEach((player, i) => emit(player.socket, { type: "state", state: viewFor(room, i), token: player.token })); }
function fail(ws, error) { emit(ws, { type: "error", message: error instanceof Error ? error.message : "Something went wrong." }); }

wss.on("connection", ws => {
  metrics.websocketConnections += 1;
  ws.isAlive = true; ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", raw => {
    let message;
    try {
      message = JSON.parse(raw.toString());
      if (message.type === "create") {
        if (rooms.size >= maxRooms) throw new Error("The gateway is at room capacity.");
        let code; do { code = roomCode(); } while (rooms.has(code));
        const player = newPlayer(message.name, message.protocol); player.socket = ws; const room = newRoom(code, player); rooms.set(code, room); metrics.roomsCreated += 1; ws.identity = { code, index: 0 }; update(room);
      } else if (message.type === "join") {
        const code = String(message.room || "").toUpperCase(); const room = rooms.get(code); if (!room) throw new Error("Room not found.");
        const reconnect = room.players.findIndex(p => p.token === message.token);
        let index = reconnect;
        if (reconnect >= 0) { room.players[reconnect].socket = ws; room.players[reconnect].connected = true; }
        else { const player = newPlayer(message.name, message.protocol); player.socket = ws; addPlayer(room, player); index = room.players.length - 1; }
        ws.identity = { code, index }; update(room);
      } else {
        if (!ws.identity) throw new Error("Join a room first.");
        const room = rooms.get(ws.identity.code); if (!room) throw new Error("Room expired."); const i = ws.identity.index;
        if (message.type === "leave") {
          const player = room.players[i];
          if (room.phase === "lobby") {
            if (i === 0) { room.players.slice(1).forEach(other => emit(other.socket, { type: "room_closed" })); rooms.delete(room.code); }
            else { room.players.splice(i, 1); update(room); }
          } else if (player?.socket === ws) { player.connected = false; player.socket = null; update(room); }
          ws.identity = null; emit(ws, { type: "left" }); return;
        }
        if (message.type === "ready") setReady(room, i, message.ready);
        else if (message.type === "start") startGame(room, i);
        else if (message.type === "offer") submitOffer(room, i, message.openId, message.hiddenId);
        else if (message.type === "swap") swapCard(room, i, message.cardId);
        else if (message.type === "choose") {
          const offer = room.offer;
          chooseOffer(room, i, message.choice);
          const chosen = offer[message.choice]; const other = offer[message.choice === "open" ? "hidden" : "open"];
          room.players.forEach(player => emit(player.socket, { type: "reveal", choice: message.choice, chosen, other, chooser: i }));
        }
        else if (message.type === "rematch") { room.rematchVotes.add(i); if (room.rematchVotes.size === 2) restart(room); }
        else throw new Error("Unknown action.");
        update(room);
      }
    } catch (error) {
      metrics.messageErrors += 1;
      if (message?.type === "create") metrics.roomCreationFailures += 1;
      log("websocket_message_error", { action: typeof message?.type === "string" ? message.type.slice(0, 24) : "invalid", error: error instanceof Error ? error.message : "Unknown error" });
      fail(ws, error);
    }
  });
  ws.on("error", error => { metrics.websocketErrors += 1; log("websocket_error", { error: error.message }); });
  ws.on("close", () => { metrics.websocketCloses += 1; if (!ws.identity) return; const room = rooms.get(ws.identity.code); const player = room?.players[ws.identity.index]; if (player?.socket === ws) { player.connected = false; if (room.phase === "lobby") player.ready = false; update(room); } });
});
wss.on("error", error => { metrics.websocketErrors += 1; log("websocket_server_error", { error: error.message }); });

const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) ws.terminate(); else { ws.isAlive = false; ws.ping(); } } const expiry = Date.now() - 1000 * 60 * 60 * 6; for (const [code, room] of rooms) if (room.updatedAt < expiry) { rooms.delete(code); metrics.roomsExpired += 1; } }, 30000);
wss.on("close", () => clearInterval(heartbeat));
server.listen(port, "0.0.0.0", () => { startupDurationMs = Date.now() - processStartedAt; log("server_ready", { port, startupDurationMs, version: healthSnapshot().version }); });
