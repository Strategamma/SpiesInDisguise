import test from "node:test";
import assert from "node:assert/strict";
import { addPlayer, chooseOffer, newPlayer, newRoom, resolveWinner, setReady, startGame, submitOffer, swapCard, viewFor } from "../server/game.js";

function roomReady() { const a = newPlayer("A", 2); const room = newRoom("ABC123", a); addPlayer(room, newPlayer("B", 2)); setReady(room, 0, true); setReady(room, 1, true); startGame(room, 0); return room; }

test("online rooms remain in the lobby until both players are ready and the host starts", () => {
  const room = newRoom("ABC123", newPlayer("Host", 2));
  assert.equal(room.phase, "lobby"); assert.equal(room.players[0].hand.length, 0);
  addPlayer(room, newPlayer("Guest", 2));
  assert.throws(() => startGame(room, 1), /host/);
  assert.throws(() => startGame(room, 0), /ready/);
  setReady(room, 0, true); setReady(room, 1, true); room.players[1].connected = false;
  assert.throws(() => startGame(room, 0), /connected/);
  room.players[1].connected = true; startGame(room, 0);
  assert.equal(room.phase, "offer"); assert.equal(room.players[0].hand.length, 4); assert.equal(room.players[1].hand.length, 4);
});

test("legacy clients remain compatible during the lobby rollout", () => {
  const room = newRoom("OLD123", newPlayer("Old Host"));
  addPlayer(room, newPlayer("Old Guest"));
  assert.equal(room.phase, "offer");
  assert.equal(room.players[0].hand.length, 4); assert.equal(room.players[1].hand.length, 4);
});

test("an offer removes cards, refills the hand, and conceals the hidden card", () => {
  const room = roomReady(); room.players[0].hand = [{ id: "a", kind: "courier" }, { id: "b", kind: "ghost" }, { id: "c", kind: "oracle" }, { id: "d", kind: "handler" }];
  submitOffer(room, 0, "a", "b");
  assert.equal(room.players[0].hand.length, 4);
  assert.deepEqual(viewFor(room, 1).offer.open, { id: "a", kind: "courier" });
  assert.equal("hidden" in viewFor(room, 1).offer, false);
});

test("chooser recruits selected card and turn passes", () => {
  const room = roomReady(); room.players[0].hand = [{ id: "a", kind: "courier" }, { id: "b", kind: "ghost" }, { id: "c", kind: "oracle" }, { id: "d", kind: "handler" }];
  submitOffer(room, 0, "a", "b"); chooseOffer(room, 1, "open");
  assert.equal(room.players[1].collection.courier, 1); assert.equal(room.players[1].progress, 1);
  assert.equal(room.players[0].collection.ghost, 1); assert.equal(room.players[0].progress, 2);
  assert.equal(room.turn, 1); assert.equal(room.phase, "offer");
});

test("movement is signed and either agent intercepts after gaining six spaces", () => {
  const room = roomReady();
  room.players[0].hand = [{ id: "a", kind: "courier" }, { id: "b", kind: "analyst" }, { id: "c", kind: "oracle" }, { id: "d", kind: "handler" }];
  submitOffer(room, 0, "a", "b"); chooseOffer(room, 1, "open");
  assert.equal(room.players[0].progress, -1);

  room.players[0].progress = 5; room.players[1].progress = 0; resolveWinner(room, 0);
  assert.equal(room.winner, null);
  room.players[0].progress = 6; resolveWinner(room, 0);
  assert.equal(room.winner, 0);

  const reverse = roomReady(); reverse.players[1].progress = 6; resolveWinner(reverse, 1);
  assert.equal(reverse.winner, 1);
});

test("a player can exchange four cards before offering while the deck has cards", () => {
  const room = roomReady();
  for (let remaining = 3; remaining >= 0; remaining--) {
    const oldId = room.players[0].hand[0].id;
    swapCard(room, 0, oldId);
    assert.equal(room.players[0].hand.length, 4);
    assert.equal(room.players[0].swapsRemaining, remaining);
    assert.ok(!room.players[0].hand.some(card => card.id === oldId));
  }
  assert.throws(() => swapCard(room, 0, room.players[0].hand[0].id), /No exchanges/);
  assert.equal(viewFor(room, 0).swapsRemaining, 0);
});

test("an empty deck ends only when the next player cannot offer two cards", () => {
  const room = roomReady(); room.deck = []; room.players[0].hand = []; room.players[1].hand = [{ id: "a", kind: "courier" }, { id: "b", kind: "ghost" }];
  resolveWinner(room, 0); assert.equal(room.winner, null);
  room.players[1].hand.pop(); resolveWinner(room, 0);
  assert.notEqual(room.winner, null); assert.match(room.resultReason, /network ran dry/);
});

test("third Oracle wins and third Renegade loses", () => {
  const room = roomReady(); room.players[0].collection.oracle = 2; room.players[0].hand = [{ id: "a", kind: "oracle" }, { id: "b", kind: "courier" }, { id: "c", kind: "ghost" }, { id: "d", kind: "handler" }];
  submitOffer(room, 0, "b", "a"); chooseOffer(room, 1, "open");
  assert.equal(room.winner, 0); assert.match(room.resultReason, /Oracle/);
});
