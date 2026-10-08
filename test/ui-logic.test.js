import test from "node:test";
import assert from "node:assert/strict";
import { nextRecruitIndex } from "../public/ui-logic.js";

test("card preview highlights the next applicable recruitment stage", () => {
  const players = [{ collection: {} }, { collection: { courier: 1, ghost: 2, oracle: 5 } }];
  assert.equal(nextRecruitIndex(players, 0, "courier"), 0);
  assert.equal(nextRecruitIndex(players, 1, "courier"), 1);
  assert.equal(nextRecruitIndex(players, 1, "ghost"), 2);
  assert.equal(nextRecruitIndex(players, 1, "oracle"), 2);
});
