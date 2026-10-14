import { LOCAL_CONTACTS } from "./local-game.js";
const LEAVES_KEY = "spies-pending-leaves-v1";

export function pendingLeaves(storage = globalThis.localStorage) {
  try {
    const entries = JSON.parse(storage.getItem(LEAVES_KEY) || "[]");
    return Array.isArray(entries) ? entries.filter(entry => entry && /^[A-Z0-9]{6}$/.test(entry.room) && typeof entry.token === "string" && typeof entry.gateway === "string" && Date.now() - entry.savedAt < 86400000) : [];
  } catch { return []; }
}

export function rememberLeave(entry, storage = globalThis.localStorage) {
  try { storage.setItem(LEAVES_KEY, JSON.stringify([...pendingLeaves(storage).filter(saved => saved.gateway !== entry.gateway || saved.room !== entry.room), { ...entry, savedAt: Date.now() }])); } catch { /* Storage may be unavailable; normal online leave still works. */ }
}

export function forgetLeave(room, gateway, storage = globalThis.localStorage) {
  try { storage.setItem(LEAVES_KEY, JSON.stringify(pendingLeaves(storage).filter(entry => entry.room !== room || entry.gateway !== gateway))); } catch { /* Optional recovery storage. */ }
}

const SAVE_KEY = "spies-offline-v1";
export function validOfflineGame(game) {
  if (!game || !["bot", "local"].includes(game.mode) || !["offer", "choose", "finished"].includes(game.phase) || ![0, 1].includes(game.turn) || ![null, 0, 1].includes(game.winner)) return false;
  if (typeof game.matchId !== "string" || typeof game.resultReason !== "string" || ![0, 1].includes(game.starter) || (game.botProfile && !["rookie", "balanced", "mastermind"].includes(game.botProfile))) return false;
  if (game.lastExchange != null && (!Array.isArray(game.lastExchange) || game.lastExchange.length !== 2 || !game.lastExchange.every(item => item && [0, 1].includes(item.playerIndex) && Object.hasOwn(LOCAL_CONTACTS, item.kind) && typeof item.summary === "string" && Array.isArray(item.notes) && item.notes.every(note => typeof note === "string") && [item.delta, item.fromSpace, item.toSpace].every(Number.isFinite)))) return false;
  if (!Array.isArray(game.players) || game.players.length !== 2 || !Array.isArray(game.deck) || game.deck.length > 42) return false;
  const ids = new Set();
  const cards = cards => Array.isArray(cards) && cards.every(card => {
    if (!card || !Object.hasOwn(LOCAL_CONTACTS, card.kind) || typeof card.id !== "string" || card.id.length > 100 || ids.has(card.id)) return false;
    ids.add(card.id); return true;
  });
  if (!cards(game.deck)) return false;
  for (const player of game.players) {
    if (!Number.isFinite(player.lastMovement) || !Number.isInteger(player.recruits) || player.recruits < 0 || player.recruits > 42 || typeof player.name !== "string" || player.name.length > 32 || !cards(player.hand) || player.hand.length > 4 || !Number.isInteger(player.progress) || Math.abs(player.progress) > 200 || !Number.isInteger(player.swapsRemaining) || player.swapsRemaining < 0 || player.swapsRemaining > 4 || !player.collection || typeof player.collection !== "object") return false;
    if (!Object.entries(player.collection).every(([kind, count]) => Object.hasOwn(LOCAL_CONTACTS, kind) && Number.isInteger(count) && count >= 0 && count <= 6)) return false;
  }
  if (game.phase === "choose") { if (!game.offer || game.offer.by !== game.turn || !cards([game.offer.open, game.offer.hidden])) return false; }
  else if (game.offer !== null) return false;
  if ((game.phase === "finished") !== (game.winner !== null)) return false;
  return ids.size <= 42;
}
export function saveOfflineGame(game, viewer, storage = globalThis.localStorage) {
  if (!validOfflineGame(game) || ![0, 1].includes(viewer)) return false;
  try { storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, game, viewer })); return true; } catch { return false; }
}
export function loadOfflineGame(storage = globalThis.localStorage) {
  try { const save = JSON.parse(storage.getItem(SAVE_KEY)); return save?.version === 1 && [0, 1].includes(save.viewer) && validOfflineGame(save.game) ? save : null; } catch { return null; }
}
export function clearOfflineGame(storage = globalThis.localStorage) { try { storage.removeItem(SAVE_KEY); } catch { /* Optional persistence. */ } }
