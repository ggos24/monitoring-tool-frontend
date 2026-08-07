import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import {
  clusterMomentumTag,
  evidenceRefText,
  formatReportFilter,
  formatReportWindow,
  rankNarratives,
  resolveBriefSections,
  resolveReportType,
  isVerbatimEvidence,
  selectedReportBasis,
} from "./report-view.ts";
import type { ReportAggregates, ReportClusterSummary } from "./types";

const aggregatesBase: ReportAggregates = {
  n_mentions: 10,
  publisher_weighted_stance: {
    supportive: 0.3,
    critical: 0.2,
    neutral: 0.4,
    mixed: 0.1,
  },
  tier_breakdown: {},
  recency_timeline: [],
  volume_z_score: null,
  sentiment_distribution: {
    supportive: 3,
    critical: 2,
    neutral: 4,
    mixed: 1,
  },
};

function cluster(
  clusterId: number,
  values: Partial<ReportClusterSummary> = {},
): ReportClusterSummary {
  return {
    cluster_id: clusterId,
    label: `cluster ${clusterId}`,
    n_mentions: 1,
    n_publishers: 1,
    dominant_stance: null,
    stance_distribution: { supportive: 0, critical: 0, neutral: 1, mixed: 0 },
    narrative: null,
    contested: null,
    ...values,
  };
}

test("new report requests and structured rolling-deploy rows resolve as briefs", () => {
  assert.equal(resolveReportType(undefined, {}, null), "executive");
  assert.equal(
    resolveReportType(undefined, { report_type: "intelligence_brief" }, null),
    "intelligence_brief",
  );
  assert.equal(
    resolveReportType(undefined, {}, { ...aggregatesBase, bottom_line: "Decision" }),
    "intelligence_brief",
  );
});

test("structured sections prefer convenience fields and clean empty items", () => {
  const sections = resolveBriefSections(
    {
      ...aggregatesBase,
      bottom_line: "aggregate bottom line",
      watchlist: ["aggregate watch"],
    },
    {
      bottom_line: "  top-level bottom line  ",
      bluf_bullets: ["  first  ", ""],
      watchlist: undefined,
    },
  );
  assert.equal(sections.bottomLine, "top-level bottom line");
  assert.deepEqual(sections.bullets, ["first"]);
  assert.deepEqual(sections.watchlist, ["aggregate watch"]);
  assert.equal(sections.hasStructuredContent, true);
});

test("narratives are ranked by prominence then share, volume and id", () => {
  const ranked = rankNarratives([
    cluster(3, { prominence: 5, share_of_voice: 0.4 }),
    cluster(2, { prominence: 8, share_of_voice: 0.2 }),
    cluster(1, { prominence: 8, share_of_voice: 0.3 }),
  ]);
  assert.deepEqual(
    ranked.map((item) => item.cluster_id),
    [1, 2, 3],
  );
});

test("momentum normalizes V2 objects/tags and legacy strings", () => {
  assert.equal(clusterMomentumTag(cluster(1, { momentum_tag: "spiking" })), "spiking");
  assert.equal(
    clusterMomentumTag(
      cluster(1, {
        momentum: { tag: "building", slope_ratio: 1.8, topic_spiking: false },
      }),
    ),
    "building",
  );
  assert.equal(clusterMomentumTag(cluster(1, { momentum: "falling" })), "fading");
});

test("evidence refs tolerate quote/text rollout aliases", () => {
  const shared = {
    mention_id: 1,
    url: null,
    domain: "example.com",
    title: "Headline",
    published_at: null,
    evidence_type: "headline" as const,
  };
  assert.equal(evidenceRefText({ ...shared, quote: "Verbatim" }), "Verbatim");
  assert.equal(evidenceRefText({ ...shared, text: "Alias" }), "Alias");
  assert.equal(evidenceRefText(shared), "Headline");
  assert.equal(
    isVerbatimEvidence({
      ...shared,
      evidence_type: "direct_quote",
      verified_verbatim: true,
    }),
    true,
  );
  assert.equal(
    isVerbatimEvidence({ ...shared, evidence_type: "verbatim_quote" }),
    false,
  );
});

test("selected data basis prefers V2 scope basis and legacy remains supported", () => {
  const legacy = {
    relevant_total: 100,
    eligible_total: 80,
    enriched_total: 60,
    analyzed_in_report: 20,
  };
  const selected = { ...legacy, analyzed_in_report: 10 };
  assert.deepEqual(
    selectedReportBasis({
      ...aggregatesBase,
      data_basis: legacy,
      selected_scope_basis: selected,
    }),
    selected,
  );
  assert.deepEqual(selectedReportBasis({ ...aggregatesBase, data_basis: legacy }), legacy);
});

test("context formatting is deterministic and operator-readable", () => {
  assert.equal(
    formatReportWindow({
      date_from: "2026-08-01T00:00:00+03:00",
      date_to: "2026-08-08T00:00:00+03:00",
    }),
    "2026-07-31 21:00 UTC → 2026-08-07 21:00 UTC",
  );
  assert.equal(
    formatReportFilter({ field: "country", op: "in", value: ["DE", "PL"] }),
    "Source country is one of DE, PL",
  );
});
