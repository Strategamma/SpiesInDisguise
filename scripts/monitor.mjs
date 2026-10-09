import WebSocket from "ws";

const baseUrl = new URL(process.env.MONITOR_URL || "https://spiesindisguise.onrender.com");
const timeoutMs = Number(process.env.MONITOR_TIMEOUT_MS || 60000);
const maxColdStartMs = Number(process.env.MAX_COLD_START_MS || 30000);
const startedAt = performance.now();

function withTimeout(label, run) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    Promise.resolve().then(run).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

function connect(url) {
  return withTimeout("WebSocket connection", () => new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  }));
}

function sendAndWait(socket, message, predicate) {
  return withTimeout(`WebSocket ${message.type}`, () => new Promise((resolve, reject) => {
    const onMessage = raw => {
      try {
        const response = JSON.parse(raw.toString());
        if (!predicate(response)) return;
        socket.off("message", onMessage);
        resolve(response);
      } catch (error) { reject(error); }
    };
    socket.on("message", onMessage);
    socket.send(JSON.stringify(message));
  }));
}

let socket;
try {
  const healthStartedAt = performance.now();
  const response = await withTimeout("Health check", () => fetch(new URL("health", baseUrl), { cache: "no-store" }));
  const healthLatencyMs = Math.round(performance.now() - healthStartedAt);
  if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}`);
  const health = await response.json();
  if (health.ok !== true) throw new Error("Gateway reported unhealthy status");

  const websocketUrl = new URL(baseUrl);
  websocketUrl.protocol = websocketUrl.protocol === "https:" ? "wss:" : "ws:";
  const websocketStartedAt = performance.now();
  socket = await connect(websocketUrl);
  const created = await sendAndWait(socket, { type: "create", name: "Uptime Monitor", protocol: 3 }, message => message.type === "state");
  const websocketLatencyMs = Math.round(performance.now() - websocketStartedAt);
  const state = created.state;
  if (state.rulesVersion !== 3 || state.phase !== "lobby" || state.players?.[0]?.ready !== false || state.hand?.length !== 0) throw new Error(`Gateway protocol mismatch: expected a rules-v3 undealt lobby, received ${state.phase}`);
  await sendAndWait(socket, { type: "leave" }, message => message.type === "left");
  socket.close();

  const result = {
    timestamp: new Date().toISOString(), event: "monitor_check", ok: true,
    url: baseUrl.origin, version: health.version, healthLatencyMs, websocketLatencyMs,
    totalLatencyMs: Math.round(performance.now() - startedAt), activeRooms: health.activeRooms,
    activeWebSockets: health.activeWebSockets, coldStartThresholdMs: maxColdStartMs
  };
  console.log(JSON.stringify(result));
  if (healthLatencyMs > maxColdStartMs) throw new Error(`Cold-start latency ${healthLatencyMs}ms exceeded ${maxColdStartMs}ms threshold`);
} catch (error) {
  socket?.close();
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), event: "monitor_check", ok: false, url: baseUrl.origin, elapsedMs: Math.round(performance.now() - startedAt), error: error.message }));
  process.exitCode = 1;
}
