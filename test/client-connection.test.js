import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
// Run the production handlers with controllable sockets/timers, without a DOM dependency.
function clientHarness() {
  const timers = new Map();
  let timerId = 0;
  const codeButton = { addEventListener(type, handler) { this[type] = handler; } };
  class Socket {
    static OPEN = 1;
    constructor() { this.listeners = {}; }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    close() { this.listeners.close?.({ code: 1000 }); }
  }
  const context = vm.createContext({
    WebSocket: Socket, timers, codeButton,
    setTimeout(handler) { const id = ++timerId; timers.set(id, handler); return id; },
    clearTimeout(id) { timers.delete(id); },
    document: {
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === "[data-private-code]" ? [codeButton] : []; }
    },
    gatewayUrl() { return "ws://local"; },
    render() {}, renderHome() {}, resume() {}, beginOnlineRoom() {},
    bindInteractionFeedback() {}, escapeHtml(value) { return value; },
    applyState(next) { context.state = next; },
    networkMode: "lan", connected: false, actionPending: false, queuedOnlineAction: null,
    pendingRoom: "", liveDuels: [], reconnectTimer: null, socket: null, state: null,
    homePanel: null, connectionError: "", revealState: null, pendingRevealState: null,
    revealComplete: null, revealTimer: null, movementNotice: null, movementTimer: null
  });
  for (const name of ["connect", "switchNetwork", "bindDuelBoard", "liveDuelBoardHtml", "finishReveal"]) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1);
    const remainder = source.slice(start);
    const end = remainder.slice(1).search(/\n(?:async )?function /);
    vm.runInContext(end < 0 ? remainder : remainder.slice(0, end + 1), context);
  }
  return context;
}

test("LAN private-code action preserves the gateway before and after presence refresh", () => {
  const client = clientHarness();
  const markup = client.liveDuelBoardHtml();
  assert.match(markup, /data-private-code/);
  assert.doesNotMatch(markup, /data-mode="wifi"/);
  for (let refresh = 0; refresh < 2; refresh++) {
    client.bindDuelBoard(); client.codeButton.click();
    assert.equal(client.networkMode, "lan");
    assert.equal(client.homePanel, "wifi");
  }
});

test("switching gateways cancels a queued room request before the new socket opens", () => {
  const client = clientHarness();
  let dispatched = 0;
  client.beginOnlineRoom = () => dispatched++;
  client.queuedOnlineAction = { isPublic: false, room: "" };
  client.switchNetwork("internet");
  client.socket.listeners.open();
  assert.equal(client.networkMode, "internet");
  assert.equal(client.queuedOnlineAction, null);
  assert.equal(dispatched, 0);
});

test("replacement during a reveal cannot restore the previous match or completion callback", () => {
  const client = clientHarness();
  client.connect();
  client.state = { room: "OLD" };
  client.revealState = { chooser: 0 };
  client.pendingRevealState = { room: "OLD", phase: "offer", players: [] };
  let completed = 0;
  client.revealComplete = () => completed++;
  client.revealTimer = client.setTimeout(client.finishReveal);
  client.movementTimer = client.setTimeout(() => {});
  client.socket.listeners.close({ code: 4001 });
  assert.equal(client.timers.size, 0);
  assert.equal(client.revealState, null);
  assert.equal(client.pendingRevealState, null);
  assert.equal(client.revealComplete, null);
  // Even an already-dispatched timer callback must not resurrect the room.
  client.finishReveal();
  assert.equal(client.state, null);
  assert.equal(completed, 0);
  assert.match(client.connectionError, /another device/);
});

test("ordinary disconnect keeps the reveal and schedules reconnection", () => {
  const client = clientHarness();
  client.connect();
  const pending = { room: "KEEP", phase: "offer", players: [] };
  client.state = { room: "KEEP" };
  client.pendingRevealState = pending;
  client.revealTimer = client.setTimeout(client.finishReveal);
  client.socket.listeners.close({ code: 1006 });
  assert.equal(client.timers.size, 2);
  client.finishReveal();
  assert.equal(client.state, pending);
});
