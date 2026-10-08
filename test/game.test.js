import test from "node:test";
import assert from "node:assert/strict";
import { addPlayer, chooseOffer, newPlayer, newRoom, submitOffer, viewFor } from "../server/game.js";

function roomReady() { const a = newPlayer("A"); const room = newRoom("ABC123", a); addPlayer(room, newPlayer("B")); return room; }

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

test("third Oracle wins and third Renegade loses", () => {
  const room = roomReady(); room.players[0].collection.oracle = 2; room.players[0].hand = [{ id: "a", kind: "oracle" }, { id: "b", kind: "courier" }, { id: "c", kind: "ghost" }, { id: "d", kind: "handler" }];
  submitOffer(room, 0, "b", "a"); chooseOffer(room, 1, "open");
  assert.equal(room.winner, 0); assert.match(room.resultReason, /Oracle/);
});
