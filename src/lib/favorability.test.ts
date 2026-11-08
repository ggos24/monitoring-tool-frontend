import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import {
  favorabilityReadiness,
  insufficientFavorabilityNote,
  reportFavorabilityReadiness,
} from "./favorability.ts";

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

const reportAgg = (dist: Partial<Record<"supportive" | "neutral" | "critical" | "mixed", number>>, extra: Record<string, unknown> = {}) =>
  ({
    n_mentions: 0,
    publisher_weighted_stance: {},
    tier_breakdown: {},
    recency_timeline: [],
    volume_z_score: null,
    sentiment_distribution: { supportive: 0, neutral: 0, critical: 0, mixed: 0, ...dist },
    ...extra,
  }) as never;

test("report: 25 scored of 289 relevant / 120 eligible is not ready", () => {
  const r = reportFavorabilityReadiness(
    reportAgg({ supportive: 25 }, {
      n_mentions: 25,
      selected_scope_basis: { relevant_total: 289, eligible_total: 120, enriched_total: 25, eligible_enriched_total: 25 },
    }),
  );
  assert.equal(r.ready, false);
  assert.equal(r.scored, 25);
  assert.equal(r.total, 120);
  assert.match(insufficientFavorabilityNote(r), /25 of 120 eligible scored.*half of eligible articles/);
});

test("report: most eligible rows scored is ready (legacy flat data_basis)", () => {
  const r = reportFavorabilityReadiness(
    reportAgg({ supportive: 20, critical: 10 }, {
      n_mentions: 30,
      data_basis: { relevant_total: 289, eligible_total: 40, enriched_total: 30 },
    }),
  );
  assert.equal(r.ready, true);
  assert.equal(r.total, 40);
});

test("report: no basis falls back to n_mentions and min 20", () => {
  assert.equal(reportFavorabilityReadiness(reportAgg({ neutral: 19 }, { n_mentions: 19 })).ready, false);
  const r = reportFavorabilityReadiness(reportAgg({ neutral: 25 }, { n_mentions: 25 }));
  assert.equal(r.ready, true);
  assert.equal(r.basis, undefined);
});
