export const LOCAL_CONTACTS = {
  courier: [1, 2, 3], analyst: [-1, 2, 5], ghost: [2, -1, 4],
  handler: [1, 3, 1], oracle: [0, 1, 2], renegade: [3, 4, -3]
};

const START_GAP = 6;

function makeDeck(random = Math.random) {
  const deck = Object.keys(LOCAL_CONTACTS).flatMap(kind => Array.from({ length: 6 }, (_, i) => ({ id: `${kind}-${i}-${Math.floor(random() * 1e9).toString(36)}`, kind })));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

function player(name) { return { name, hand: [], collection: {}, progress: 0, connected: true }; }
function draw(game, target) { while (target.hand.length < 4 && game.deck.length) target.hand.push(game.deck.pop()); }

export function createLocalGame(mode, humanName = "Agent", random = Math.random) {
  const opponent = mode === "bot" ? "Cipher Bot" : "Player Two";
  const game = { mode, room: mode === "bot" ? "BOT" : "LOCAL", players: [player(humanName), player(opponent)], deck: makeDeck(random), turn: 0, phase: "offer", offer: null, winner: null, resultReason: "" };
  game.players.forEach(p => draw(game, p));
  return game;
}

export function localOffer(game, playerIndex, openId, hiddenId) {
  if (game.winner !== null || game.phase !== "offer" || game.turn !== playerIndex) throw new Error("It isn’t time to offer cards.");
  const active = game.players[playerIndex];
  const open = active.hand.find(c => c.id === openId); const hidden = active.hand.find(c => c.id === hiddenId);
  if (!open || !hidden || open.id === hidden.id) throw new Error("Choose two cards from your hand.");
  if (open.kind === hidden.kind && active.hand.some(c => c.kind !== open.kind)) throw new Error("The two contacts must be different.");
  active.hand = active.hand.filter(c => c.id !== openId && c.id !== hiddenId);
  draw(game, active); game.offer = { open, hidden, by: playerIndex }; game.phase = "choose";
}

function recruit(target, card) {
  const count = (target.collection[card.kind] || 0) + 1;
  target.collection[card.kind] = count;
  target.progress += LOCAL_CONTACTS[card.kind][Math.min(2, count - 1)];
}

export function localChoose(game, playerIndex, choice) {
  if (game.winner !== null || game.phase !== "choose" || !game.offer || game.offer.by === playerIndex) throw new Error("It isn’t time to choose.");
  if (!['open', 'hidden'].includes(choice)) throw new Error("Choose one of the two signals.");
  const active = game.offer.by;
  recruit(game.players[playerIndex], game.offer[choice]);
  recruit(game.players[active], game.offer[choice === "open" ? "hidden" : "open"]);
  resolve(game, active); game.offer = null;
  if (game.winner === null) { game.turn = playerIndex; game.phase = "offer"; }
}

function resolve(game, active) {
  const wins = game.players.map((p, i) => p.progress - game.players[1 - i].progress >= START_GAP || (p.collection.oracle || 0) >= 3);
  const loses = game.players.map(p => (p.collection.renegade || 0) >= 3);
  const candidates = [0, 1].filter(i => wins[i] || loses[1 - i]);
  if (candidates.length) {
    game.winner = candidates.length === 2 ? active : candidates[0]; game.phase = "finished";
    const winner = game.players[game.winner];
    game.resultReason = (winner.collection.oracle || 0) >= 3 ? "Three Oracles exposed the rival network." : loses[1 - game.winner] ? "The rival recruited a third Renegade." : "The rival was caught on the 12-space loop.";
  } else if (!game.deck.length && game.players.some(p => p.hand.length < 2)) {
    game.winner = game.players[0].progress === game.players[1].progress ? active : (game.players[0].progress > game.players[1].progress ? 0 : 1);
    game.resultReason = "The network ran dry; the closest pursuer wins."; game.phase = "finished";
  }
}

export function localView(game, you) {
  return { room: game.room, mode: game.mode, you, turn: game.turn, phase: game.phase, winner: game.winner, resultReason: game.resultReason, hand: game.players[you].hand, players: game.players.map(p => ({ name: p.name, collection: p.collection, progress: p.progress, connected: true })), offer: game.offer ? { open: game.offer.open, by: game.offer.by } : null };
}

function cardValue(game, playerIndex, card) {
  const player = game.players[playerIndex]; const count = (player.collection[card.kind] || 0) + 1;
  if (card.kind === "oracle" && count >= 3) return 100;
  if (card.kind === "renegade" && count >= 3) return -100;
  return LOCAL_CONTACTS[card.kind][Math.min(2, count - 1)] * 4 + (card.kind === "oracle" ? count * 3 : 0);
}

export function chooseBotOffer(game) {
  const hand = game.players[1].hand;
  let best = null;
  for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) {
    if (hand[i].kind === hand[j].kind && hand.some(c => c.kind !== hand[i].kind)) continue;
    const low = Math.min(cardValue(game, 1, hand[i]), cardValue(game, 1, hand[j]));
    if (!best || low > best.score) best = { openId: hand[i].id, hiddenId: hand[j].id, score: low };
  }
  return best;
}

export function chooseBotCard(game) {
  const bot = 1; const open = game.offer.open; const hidden = game.offer.hidden;
  const openScore = cardValue(game, bot, open) - cardValue(game, 0, hidden) * .35;
  const hiddenScore = cardValue(game, bot, hidden) - cardValue(game, 0, open) * .35;
  return hiddenScore > openScore ? "hidden" : "open";
}
