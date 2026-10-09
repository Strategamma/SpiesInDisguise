import test from "node:test";
import assert from "node:assert/strict";
import { availableDuels } from "../server/presence.js";

function room(code, host, options = {}) {
  return { code, public: options.public ?? true, phase: options.phase ?? "lobby", updatedAt: options.updatedAt ?? 1, players: [{ name: host, connected: options.connected ?? true }, ...(options.guest ? [{ name: options.guest, connected: true }] : [])] };
}

test("presence only exposes connected hosts of open public lobbies", () => {
  const rooms = new Map([
    ["OPEN01", room("OPEN01", "Nightjar", { updatedAt: 5 })],
    ["PRIVATE", room("PRIVATE", "Secret", { public: false })],
    ["PLAY02", room("PLAY02", "Busy", { phase: "offer" })],
    ["FULL03", room("FULL03", "Paired", { guest: "Rival" })],
    ["AWAY04", room("AWAY04", "Away", { connected: false })]
  ]);
  assert.deepEqual(availableDuels(rooms), [{ room: "OPEN01", host: "Nightjar" }]);
});

test("presence returns the eight freshest available duels", () => {
  const rooms = new Map(Array.from({ length: 10 }, (_, i) => [`ROOM${i}`, room(`ROOM${i}`, `Agent ${i}`, { updatedAt: i })]));
  assert.deepEqual(availableDuels(rooms).map(item => item.host), ["Agent 9", "Agent 8", "Agent 7", "Agent 6", "Agent 5", "Agent 4", "Agent 3", "Agent 2"]);
});
