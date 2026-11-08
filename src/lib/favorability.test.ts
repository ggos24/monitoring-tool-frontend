import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import { favorabilityReadiness, insufficientFavorabilityNote } from "./favorability.ts";

const counts = (favorable: number, neutral: number, unfavorable: number, mixed: number, unscored: number) => ({
  favorable,
  neutral,
  unfavorable,
  mixed,
  unscored,
});

test("fallback: 2 of 289 scored is not ready", () => {
  const r = favorabilityReadiness(counts(2, 0, 0, 0, 287));
  assert.equal(r.ready, false);
  assert.equal(r.scored, 2);
  assert.equal(r.total, 289);
  assert.equal(r.minScored, 20);
  assert.equal(r.minShare, 0.5);
});

test("fallback: needs both the minimum count and the minimum share", () => {
  assert.equal(favorabilityReadiness(counts(10, 5, 3, 1, 0)).ready, false); // 19 scored
  assert.equal(favorabilityReadiness(counts(10, 5, 4, 1, 0)).ready, true); // 20 of 20
  assert.equal(favorabilityReadiness(counts(10, 5, 4, 1, 21)).ready, false); // 20 of 41
  assert.equal(favorabilityReadiness(counts(10, 5, 4, 1, 20)).ready, true); // exactly half
});

test("fallback: empty or missing counts are not ready", () => {
  assert.equal(favorabilityReadiness(counts(0, 0, 0, 0, 0)).ready, false);
  assert.equal(favorabilityReadiness(undefined).ready, false);
  assert.equal(favorabilityReadiness(null).total, 0);
});

test("backend sufficient flag wins over the local rule", () => {
  assert.equal(favorabilityReadiness(counts(2, 0, 0, 0, 0), { sufficient: true }).ready, true);
  assert.equal(favorabilityReadiness(counts(30, 0, 0, 0, 0), { sufficient: false }).ready, false);
});

test("backend thresholds and n_scored are used when present", () => {
  const r = favorabilityReadiness(counts(5, 0, 0, 0, 5), {
    n_scored: 5,
    min_scored: 5,
    min_scored_share: 0.4,
  });
  assert.equal(r.ready, true);
  assert.equal(r.minScored, 5);
  assert.equal(r.minShare, 0.4);
});

test("note names the counts and the thresholds", () => {
  const note = insufficientFavorabilityNote(favorabilityReadiness(counts(2, 0, 0, 0, 287)));
  assert.equal(
    note,
    "Not enough scored articles yet — 2 of 289 scored. Shares appear once at least 20 articles and half of all are scored.",
  );
});
