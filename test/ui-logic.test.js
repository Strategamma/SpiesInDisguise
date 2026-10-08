import test from "node:test";
import assert from "node:assert/strict";
import { boardPosition, interceptionGap, nextRecruitIndex, recruitMovementNotice } from "../public/ui-logic.js";

test("card preview highlights the next applicable recruitment stage", () => {
  const players = [{ collection: {} }, { collection: { courier: 1, ghost: 2, oracle: 5 } }];
  assert.equal(nextRecruitIndex(players, 0, "courier"), 0);
  assert.equal(nextRecruitIndex(players, 1, "courier"), 1);
  assert.equal(nextRecruitIndex(players, 1, "ghost"), 2);
  assert.equal(nextRecruitIndex(players, 1, "oracle"), 2);
});

test("board positions share one twelve-space clockwise loop with a six-space gap", () => {
  assert.equal(boardPosition(0, 0), 0);
  assert.equal(boardPosition(1, 0), 6);
  assert.equal(boardPosition(0, 2), 2);
  assert.equal(boardPosition(1, 2), 8);
  assert.equal(boardPosition(0, -1), 11);
  assert.equal(interceptionGap([{ progress: 0 }, { progress: 0 }]), 6);
  assert.equal(interceptionGap([{ progress: 4 }, { progress: 1 }]), 3);
  assert.equal(interceptionGap([{ progress: -2 }, { progress: 4 }]), 0);
});

test("recruit feedback maps each revealed card to its recipient and movement", () => {
  const previous = { players: [{ progress: 2 }, { progress: -1 }] };
  const next = { players: [{ progress: 8 }, { progress: -3 }] };
  assert.deepEqual(recruitMovementNotice(previous, next, { chooser: 0, chosen: { kind: "analyst" }, other: { kind: "handler" } }), [
    { playerIndex: 0, kind: "analyst", delta: 6 },
    { playerIndex: 1, kind: "handler", delta: -2 }
  ]);
});
