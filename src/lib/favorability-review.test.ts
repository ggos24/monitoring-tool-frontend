import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import { EMPTY_FAV_DRAFT, QUESTIONS, compareAnswers, draftScore, favScore, isComplete } from "./favorability-review.ts";

test("score follows the prompt table", () => {
  assert.equal(favScore({ fact_status: "confirmed", actor: "international", direction: "helps" }), 2);
  assert.equal(favScore({ fact_status: "announced", actor: "international", direction: "harms" }), -1);
  assert.equal(favScore({ fact_status: "opinion", actor: "international", direction: "both" }), 0);
  assert.equal(favScore({ fact_status: "confirmed", actor: "russia", direction: "harms" }), -1);
  assert.equal(favScore({ fact_status: "confirmed", actor: "ukraine", direction: "helps" }), 1);
  assert.equal(favScore({ fact_status: "announced", actor: "russia", direction: "harms" }), 0);
  assert.equal(favScore({ fact_status: "confirmed", actor: "none", direction: "harms" }), 0);
  assert.equal(favScore({ fact_status: "none", actor: "international", direction: "helps" }), 0);
});

test("draft completeness and score", () => {
  assert.equal(isComplete(EMPTY_FAV_DRAFT), false);
  assert.equal(draftScore(EMPTY_FAV_DRAFT), null);
  const d = { ...EMPTY_FAV_DRAFT, fact_status: "confirmed", actor: "international", direction: "harms", coverage: "neutral" } as const;
  assert.equal(isComplete(d), true);
  assert.equal(draftScore(d), -2);
});

test("every question has four options and help", () => {
  assert.deepEqual(QUESTIONS.map((q) => q.key), ["actor", "fact_status", "direction", "coverage"]);
  for (const q of QUESTIONS) {
    assert.equal(q.options.length, 4);
    assert.ok(q.help.length > 10);
  }
});

test("compare answers marks matches and missing model", () => {
  const mine = { fact_status: "confirmed", actor: "russia", direction: "harms", coverage: "favorable" } as const;
  const rows = compareAnswers(mine, { ...mine, coverage: "neutral" });
  assert.deepEqual(rows.map((r) => r.same), [true, true, true, false]);
  assert.equal(rows[0].mine, "Russia");
  assert.ok(compareAnswers(mine, null).every((r) => r.same === null && r.model === null));
});
