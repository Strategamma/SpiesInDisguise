import test from "node:test";
import assert from "node:assert/strict";
import { chooseBotCard, chooseBotOffer, createLocalGame, localChoose, localOffer, localSwap, localView } from "../public/local-game.js";

test("local pass-and-play keeps the concealed contact out of the view", () => {
  const game = createLocalGame("local", "One", () => .4);
  game.players[0].hand = [{ id: "a", kind: "courier" }, { id: "b", kind: "ghost" }, { id: "c", kind: "oracle" }, { id: "d", kind: "handler" }];
  localOffer(game, 0, "a", "b");
  assert.equal("hidden" in localView(game, 1).offer, false);
  localChoose(game, 1, "hidden");
  assert.equal(game.turn, 1);
});

test("bot always offers a legal pair and returns a valid choice", () => {
  const game = createLocalGame("bot", "One", () => .2); game.turn = 1;
  const offer = chooseBotOffer(game);
  assert.ok(offer.openId && offer.hiddenId && offer.openId !== offer.hiddenId);
  localOffer(game, 1, offer.openId, offer.hiddenId);
  assert.ok(["open", "hidden"].includes(chooseBotCard(game)));
});

test("local chase uses the same six-space relative interception rule", () => {
  const game = createLocalGame("local", "One", () => .3);
  game.players[0].progress = 5;
  game.players[0].hand = [{ id: "a", kind: "oracle" }, { id: "b", kind: "courier" }, { id: "c", kind: "ghost" }, { id: "d", kind: "handler" }];
  localOffer(game, 0, "a", "b"); localChoose(game, 1, "open");
  assert.equal(game.players[0].progress, 6);
  assert.equal(game.winner, 0);
  assert.match(game.resultReason, /12-space loop/);
});

test("local exchanges preserve hand size and enforce the four-card limit", () => {
  const game = createLocalGame("local", "One", () => .35);
  for (let remaining = 3; remaining >= 0; remaining--) {
    localSwap(game, 0, game.players[0].hand[0].id);
    assert.equal(game.players[0].hand.length, 4);
    assert.equal(game.players[0].swapsRemaining, remaining);
  }
  assert.throws(() => localSwap(game, 0, game.players[0].hand[0].id), /No exchanges/);
  assert.equal(localView(game, 0).swapsRemaining, 0);
});
