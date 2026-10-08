import crypto from "node:crypto";

export const CONTACTS = {
  courier: [1, 2, 3], analyst: [-1, 2, 5], ghost: [2, -1, 4],
  handler: [1, 3, 1], oracle: [0, 1, 2], renegade: [3, 4, -3]
};

const START_GAP = 6;
const COPIES = 6;

export function token() { return crypto.randomBytes(18).toString("base64url"); }
export function roomCode() { return crypto.randomBytes(4).toString("base64url").replace(/[-_]/g, "X").slice(0, 6).toUpperCase(); }

export function makeDeck(random = Math.random) {
  const deck = Object.keys(CONTACTS).flatMap(kind => Array.from({ length: COPIES }, (_, i) => ({ id: `${kind}-${i}-${crypto.randomBytes(3).toString("hex")}`, kind })));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

export function newPlayer(name, protocol = 1) {
  return { name: String(name || "Agent").trim().slice(0, 18) || "Agent", token: token(), hand: [], collection: {}, progress: 0, socket: null, connected: true, ready: false, protocol: Number(protocol) || 1 };
}

export function newRoom(code, host) {
  return { code, players: [host], deck: makeDeck(), turn: 0, phase: "lobby", offer: null, winner: null, resultReason: "", updatedAt: Date.now(), rematchVotes: new Set() };
}

export function addPlayer(room, player) {
  if (room.phase !== "lobby") throw new Error("That match has already started.");
  if (room.players.length >= 2) throw new Error("That room is full.");
  room.players.push(player);
  if (room.players.some(member => member.protocol < 2)) { room.players.forEach(member => draw(room, member)); room.phase = "offer"; }
  room.updatedAt = Date.now();
}

export function setReady(room, playerIndex, ready) {
  if (room.phase !== "lobby") throw new Error("The match has already started.");
  const player = room.players[playerIndex];
  if (!player) throw new Error("Player not found.");
  player.ready = Boolean(ready); room.updatedAt = Date.now();
}

export function startGame(room, playerIndex) {
  if (room.phase !== "lobby") throw new Error("The match has already started.");
  if (playerIndex !== 0) throw new Error("Only the host can start the match.");
  if (room.players.length !== 2) throw new Error("Two players are required.");
  if (room.players.some(player => !player.connected || !player.ready)) throw new Error("Both players must be connected and ready.");
  room.players.forEach(player => draw(room, player));
  room.phase = "offer"; room.updatedAt = Date.now();
}

export function draw(room, player) { while (player.hand.length < 4 && room.deck.length) player.hand.push(room.deck.pop()); }

export function submitOffer(room, playerIndex, openId, hiddenId) {
  if (room.winner !== null || room.phase !== "offer" || room.turn !== playerIndex) throw new Error("It isn’t time to offer cards.");
  const player = room.players[playerIndex];
  const open = player.hand.find(c => c.id === openId); const hidden = player.hand.find(c => c.id === hiddenId);
  if (!open || !hidden || open.id === hidden.id) throw new Error("Choose two cards from your hand.");
  const hasAlternative = player.hand.some(c => c.kind !== open.kind);
  if (open.kind === hidden.kind && hasAlternative) throw new Error("The two contacts must be different.");
  player.hand = player.hand.filter(c => c.id !== openId && c.id !== hiddenId);
  draw(room, player); room.offer = { open, hidden, by: playerIndex }; room.phase = "choose"; room.updatedAt = Date.now();
}

function recruit(player, card) {
  const count = (player.collection[card.kind] || 0) + 1;
  player.collection[card.kind] = count;
  const movement = CONTACTS[card.kind][Math.min(2, count - 1)];
  player.progress += movement;
}

export function chooseOffer(room, playerIndex, choice) {
  if (room.winner !== null || room.phase !== "choose" || !room.offer || room.offer.by === playerIndex) throw new Error("It isn’t time to choose.");
  if (!['open', 'hidden'].includes(choice)) throw new Error("Choose one of the two signals.");
  const active = room.offer.by; const chooserCard = room.offer[choice]; const activeCard = room.offer[choice === "open" ? "hidden" : "open"];
  recruit(room.players[playerIndex], chooserCard); recruit(room.players[active], activeCard);
  resolveWinner(room, active);
  room.offer = null;
  if (room.winner === null) { room.turn = playerIndex; room.phase = "offer"; }
  room.updatedAt = Date.now();
}

export function resolveWinner(room, active) {
  const wins = room.players.map((p, i) => p.progress - room.players[1 - i].progress >= START_GAP || (p.collection.oracle || 0) >= 3);
  const loses = room.players.map(p => (p.collection.renegade || 0) >= 3);
  const candidates = [0, 1].filter(i => wins[i] || loses[1 - i]);
  if (candidates.length) {
    room.winner = candidates.length === 2 ? active : candidates[0];
    const winner = room.players[room.winner];
    room.resultReason = (winner.collection.oracle || 0) >= 3 ? "Three Oracles exposed the rival network." : loses[1 - room.winner] ? "The rival recruited a third Renegade." : "The rival was caught on the 12-space loop.";
    room.phase = "finished";
    return;
  }
  if (!room.deck.length && room.players.some(p => p.hand.length < 2)) {
    room.winner = room.players[0].progress === room.players[1].progress ? active : (room.players[0].progress > room.players[1].progress ? 0 : 1);
    room.resultReason = "The network ran dry; the closest pursuer wins."; room.phase = "finished";
  }
}

export function restart(room) {
  room.deck = makeDeck(); room.turn = 1 - room.turn; room.phase = "offer"; room.offer = null; room.winner = null; room.resultReason = ""; room.rematchVotes.clear();
  for (const p of room.players) { p.hand = []; p.collection = {}; p.progress = 0; draw(room, p); }
  room.updatedAt = Date.now();
}

export function viewFor(room, you) {
  const offer = room.offer ? { open: room.offer.open, by: room.offer.by } : null;
  return {
    room: room.code, you, turn: room.turn, phase: room.phase, winner: room.winner, resultReason: room.resultReason,
    hand: room.players[you].hand,
    isHost: you === 0, rematchVotes: room.rematchVotes.size, youRematch: room.rematchVotes.has(you),
    players: room.players.map(p => ({ name: p.name, collection: p.collection, progress: p.progress, connected: p.connected, ready: p.ready })),
    offer
  };
}
