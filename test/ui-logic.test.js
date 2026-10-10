import test from "node:test";
import assert from "node:assert/strict";
import { boardPosition, contactStageEffect, interceptionGap, nextRecruitIndex, projectedCardPosition, recruitMovementNotice, resolutionMovementNotice, stateMotionCue } from "../public/ui-logic.js";

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

test("card previews project the correct recipient from current to destination space", () => {
  const players = [{ progress: 11 }, { progress: -2 }];
  assert.deepEqual(projectedCardPosition(players, 0, 2), { current: 12, destination: 2 });
  assert.deepEqual(projectedCardPosition(players, 1, -3), { current: 5, destination: 2 });
  assert.deepEqual(projectedCardPosition(players, 1, 0), { current: 5, destination: 5 });
});

test("third Oracle and Renegade stages show outcomes instead of zero movement", () => {
  assert.deepEqual(contactStageEffect("oracle", 2, 0), { icon: "★", label: "Victory", shortLabel: "Win", className: "victory" });
  assert.deepEqual(contactStageEffect("renegade", 2, 0), { icon: "✕", label: "Defeat", shortLabel: "Lose", className: "defeat" });
  assert.deepEqual(contactStageEffect("ghost", 0, 0), { icon: "0", label: "0 movement", shortLabel: "", className: "movement" });
});

test("motion cues only fire for meaningful game-state changes", () => {
  const base = { phase: "offer", winner: null, hand: [{ id: "a" }], players: [{ ready: false }, { ready: false }] };
  assert.equal(stateMotionCue(base, { ...base, phase: "choose" }), "offer");
  assert.equal(stateMotionCue(base, { ...base, hand: [{ id: "b" }] }), "deal");
  assert.equal(stateMotionCue(base, { ...base, players: [{ ready: true }, { ready: false }] }), "ready");
  assert.equal(stateMotionCue(base, { ...base, winner: 0 }), "result");
  assert.equal(stateMotionCue(base, structuredClone(base)), null);
});

test("recruit feedback maps each revealed card to its recipient and movement", () => {
  const previous = { players: [{ progress: 2 }, { progress: -1 }] };
  const next = { players: [{ progress: 8 }, { progress: -3 }] };
  assert.deepEqual(recruitMovementNotice(previous, next, { chooser: 0, chosen: { kind: "analyst" }, other: { kind: "handler" } }), [
    { playerIndex: 0, kind: "analyst", delta: 6 },
    { playerIndex: 1, kind: "handler", delta: -2 }
  ]);
});

test("resolution recap keeps ownership, movement, and board spaces together", () => {
  const previous = { players: [{ progress: 11 }, { progress: -1 }] };
  const next = { players: [{ progress: 13 }, { progress: -4 }] };
  assert.deepEqual(resolutionMovementNotice(previous, next, { chooser: 1, chosen: { kind: "sleeper" }, other: { kind: "courier" } }), [
    { playerIndex: 1, kind: "sleeper", delta: -3, fromSpace: 6, toSpace: 3 },
    { playerIndex: 0, kind: "courier", delta: 2, fromSpace: 12, toSpace: 2 }
  ]);
});
