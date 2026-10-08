import test from "node:test";
import assert from "node:assert/strict";
import { chooseBotCard, chooseBotOffer, createLocalGame, localChoose, localOffer, localView } from "../public/local-game.js";

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
