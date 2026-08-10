import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import {
  artifactHref,
  buildNarrativesHref,
  changeCounts,
  formatDeltaPp,
  narrativePresentation,
  observationForPeriod,
  parseNarrativesPageState,
} from "./narrative-view.ts";
import type {
  NarrativeObservation,
  NarrativePeriod,
  NarrativeSummary,
} from "./types";

const periods: NarrativePeriod[] = [
  period("2026-07-20", 101),
  period("2026-07-27", 102),
  period("2026-08-03", 103),
];

test("URL state is allowlisted and group scope wins ambiguous links", () => {
  assert.deepEqual(
    parseNarrativesPageState({
      topic_id: "4",
      group_id: "9",
      periods: "24",
      view: "list",
      series_key: "digest:17",
      narrative_id: "nar_abc",
    }),
    {
      scope: { kind: "group", id: 9 },
      periods: 24,
      view: "list",
      seriesKey: "digest:17",
      narrativeId: "nar_abc",
    },
  );
  assert.deepEqual(parseNarrativesPageState({ periods: "999", view: "graph" }), {
    scope: null,
    periods: 12,
    view: "evolution",
    seriesKey: null,
    narrativeId: null,
  });
});

test("narrative href preserves the complete shareable state", () => {
  assert.equal(
    buildNarrativesHref({
      scope: { kind: "topic", id: 7 },
      seriesKey: "report:weekly/a+b",
      periods: 6,
      view: "evolution",
      narrativeId: "nar_1",
    }),
    "/narratives?topic_id=7&series_key=report%3Aweekly%2Fa%2Bb&periods=6&view=evolution&narrative_id=nar_1",
  );
});

test("period alignment keeps gaps honest and detects resurfacing", () => {
  const first = observation(periods[0], 0.12, "returning", "stable");
  const gap = notObserved(periods[1]);
  const latest = observation(periods[2], 0.08, "returning", "growing");
  const row = narrative("resurfaced", [first, gap, latest]);
  assert.equal(observationForPeriod(row, periods[1])?.status, "not_observed");
  assert.deepEqual(narrativePresentation(row, periods), {
    state: "resurfaced",
    label: "Resurfaced",
    current: latest,
    previous: null,
    latest,
    shareDelta: null,
  });
});

test("latest-period deltas use fractions and not-observed stays separate", () => {
  const previous = observation(periods[1], 0.1, "returning", "stable");
  const current = observation(periods[2], 0.145, "returning", "growing");
  const growing = narrative("growing", [previous, current]);
  const absent = narrative("absent", [
    observation(periods[0], 0.2),
    notObserved(periods[2]),
  ]);
  const unknown = narrative("unknown", [observation(periods[0], 0.1)]);
  assert.equal(narrativePresentation(growing, periods).shareDelta, 0.044999999999999984);
  assert.equal(formatDeltaPp(0.045), "+4.5pp");
  assert.equal(formatDeltaPp(-0.045), "−4.5pp");
  assert.equal(narrativePresentation(unknown, periods).state, "unknown");
  assert.deepEqual(changeCounts([growing, absent, unknown], periods), {
    newly_observed: 0,
    growing: 1,
    declining: 0,
    stable: 0,
    not_observed: 1,
  });
});

test("originating artifact links preserve scope and artifact kind", () => {
  assert.equal(
    artifactHref(periods[0], { kind: "topic", id: 7 }),
    "/reports?topic_id=7&report_id=101",
  );
  assert.equal(
    artifactHref(
      { ...periods[0], artifact_type: "digest", artifact_id: 51 },
      { kind: "group", id: 3 },
    ),
    "/reports?group_id=3&digest_result_id=51",
  );
});

function period(start: string, artifactId: number): NarrativePeriod {
  return {
    period_start: `${start}T00:00:00Z`,
    period_end: `${start}T23:59:59Z`,
    artifact_type: "report",
    artifact_id: artifactId,
    n_mentions: 20,
  };
}

function observation(
  value: NarrativePeriod,
  share: number,
  status: NarrativeObservation["status"] = "returning",
  direction: NarrativeObservation["direction"] = "stable",
): NarrativeObservation {
  return {
    period_start: value.period_start,
    period_end: value.period_end,
    status,
    direction,
    match_score: 0.9,
    share_of_voice: share,
    reach_sov: share,
    prominence: share * 100,
    n_mentions: 10,
    n_publishers: 5,
    momentum: null,
    mean_source_score: 3,
    mean_reach_score: 60,
    propaganda_share: 0,
    countries: [],
    top_domains: [],
    evidence_refs: [],
  };
}

function notObserved(value: NarrativePeriod): NarrativeObservation {
  return {
    period_start: value.period_start,
    period_end: value.period_end,
    status: "not_observed",
    direction: "not_observed",
    match_score: null,
    share_of_voice: null,
    reach_sov: null,
    prominence: null,
    n_mentions: null,
    n_publishers: null,
    momentum: null,
    mean_source_score: null,
    mean_reach_score: null,
    propaganda_share: null,
    countries: [],
    top_domains: [],
    evidence_refs: [],
  };
}

function narrative(
  id: string,
  observations: NarrativeObservation[],
): NarrativeSummary {
  return {
    narrative_id: id,
    identity_source: "persisted",
    name: id,
    claim: null,
    first_observed_at: observations[0].period_start,
    last_observed_at: observations[observations.length - 1].period_start,
    observation_count: observations.length,
    current: observations[observations.length - 1],
    observations,
  };
}
