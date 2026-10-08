import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { addPlayer, chooseOffer, newPlayer, newRoom, restart, roomCode, setReady, startGame, submitOffer, viewFor } from "./game.js";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const rooms = new Map();
const port = Number(process.env.PORT || 3000);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); return res.end('{"ok":true}'); }
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
  ws.isAlive = true; ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === "create") {
        let code; do { code = roomCode(); } while (rooms.has(code));
        const player = newPlayer(message.name, message.protocol); player.socket = ws; const room = newRoom(code, player); rooms.set(code, room); ws.identity = { code, index: 0 }; update(room);
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
          ws.identity = null; return;
        }
        if (message.type === "ready") setReady(room, i, message.ready);
        else if (message.type === "start") startGame(room, i);
        else if (message.type === "offer") submitOffer(room, i, message.openId, message.hiddenId);
        else if (message.type === "choose") chooseOffer(room, i, message.choice);
        else if (message.type === "rematch") { room.rematchVotes.add(i); if (room.rematchVotes.size === 2) restart(room); }
        else throw new Error("Unknown action.");
        update(room);
      }
    } catch (error) { fail(ws, error); }
  });
  ws.on("close", () => { if (!ws.identity) return; const room = rooms.get(ws.identity.code); const player = room?.players[ws.identity.index]; if (player?.socket === ws) { player.connected = false; if (room.phase === "lobby") player.ready = false; update(room); } });
});

const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) ws.terminate(); else { ws.isAlive = false; ws.ping(); } } const expiry = Date.now() - 1000 * 60 * 60 * 6; for (const [code, room] of rooms) if (room.updatedAt < expiry) rooms.delete(code); }, 30000);
wss.on("close", () => clearInterval(heartbeat));
server.listen(port, "0.0.0.0", () => console.log(`Spies in Disguise ready on http://localhost:${port}`));
