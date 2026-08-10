import type {
  ClusterMomentumTag,
  NarrativeObservation,
  NarrativePeriod,
  NarrativeSummary,
  ScopeParam,
  ScopeSelection,
} from "./types";

export const NARRATIVE_PERIOD_OPTIONS = [6, 12, 24] as const;
export type NarrativePeriodLimit = (typeof NARRATIVE_PERIOD_OPTIONS)[number];
export type NarrativeView = "evolution" | "list";

export type NarrativesPageState = {
  scope: ScopeSelection | null;
  seriesKey: string | null;
  periods: NarrativePeriodLimit;
  view: NarrativeView;
  narrativeId: string | null;
};

export type NarrativeStateKey =
  | "newly_observed"
  | "growing"
  | "declining"
  | "stable"
  | "resurfaced"
  | "unknown"
  | "not_observed";

export type NarrativePresentation = {
  state: NarrativeStateKey;
  label: string;
  current: NarrativeObservation | null;
  previous: NarrativeObservation | null;
  latest: NarrativeObservation | null;
  shareDelta: number | null;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseNarrativesPageState(
  searchParams: RawSearchParams,
): NarrativesPageState {
  const groupId = positiveInt(scalar(searchParams.group_id));
  const topicId = positiveInt(scalar(searchParams.topic_id));
  const rawPeriods = positiveInt(scalar(searchParams.periods));
  const periods = NARRATIVE_PERIOD_OPTIONS.includes(rawPeriods as NarrativePeriodLimit)
    ? (rawPeriods as NarrativePeriodLimit)
    : 12;
  const rawView = scalar(searchParams.view);

  return {
    scope:
      groupId !== null
        ? { kind: "group", id: groupId }
        : topicId !== null
          ? { kind: "topic", id: topicId }
          : null,
    seriesKey: nonEmpty(scalar(searchParams.series_key)),
    periods,
    view: rawView === "list" ? "list" : "evolution",
    narrativeId: nonEmpty(scalar(searchParams.narrative_id)),
  };
}

export function buildNarrativesHref(state: NarrativesPageState): string {
  const query = new URLSearchParams();
  if (state.scope?.kind === "group") {
    query.set("group_id", String(state.scope.id));
  } else if (state.scope) {
    query.set("topic_id", String(state.scope.id));
  }
  if (state.seriesKey) query.set("series_key", state.seriesKey);
  query.set("periods", String(state.periods));
  query.set("view", state.view);
  if (state.narrativeId) query.set("narrative_id", state.narrativeId);
  return `/narratives?${query.toString()}`;
}

export function toScopeParam(scope: ScopeSelection): ScopeParam {
  return scope.kind === "group"
    ? { group_id: scope.id }
    : { topic_id: scope.id };
}

export function sortPeriods(periods: NarrativePeriod[]): NarrativePeriod[] {
  return [...periods].sort((left, right) =>
    periodKey(left).localeCompare(periodKey(right)),
  );
}

export function observationForPeriod(
  narrative: NarrativeSummary,
  period: Pick<NarrativePeriod, "period_start" | "period_end"> | undefined,
): NarrativeObservation | null {
  if (!period) return null;
  return (
    narrative.observations.find(
      (observation) =>
        observation.period_start === period.period_start &&
        observation.period_end === period.period_end,
    ) ?? null
  );
}

export function isNotObservedObservation(
  observation: NarrativeObservation | null | undefined,
): boolean {
  return Boolean(
    observation &&
      (observation.status === "not_observed" ||
        observation.direction === "not_observed"),
  );
}

export function isActiveObservation(
  observation: NarrativeObservation | null | undefined,
): observation is NarrativeObservation {
  return Boolean(observation) && !isNotObservedObservation(observation);
}

export function narrativePresentation(
  narrative: NarrativeSummary,
  periods: NarrativePeriod[],
): NarrativePresentation {
  const ordered = sortPeriods(periods);
  const currentPeriod = ordered.at(-1);
  const previousPeriod = ordered.at(-2);
  const latest = observationForPeriod(narrative, currentPeriod);
  const rawPrevious = observationForPeriod(narrative, previousPeriod);
  const current = isActiveObservation(latest) ? latest : null;
  const previous = isActiveObservation(rawPrevious) ? rawPrevious : null;
  const shareDelta =
    current?.share_of_voice != null && previous?.share_of_voice != null
      ? current.share_of_voice - previous.share_of_voice
      : null;

  if (!latest) {
    return {
      state: "unknown",
      label: "No observation",
      current,
      previous,
      latest,
      shareDelta,
    };
  }
  if (isNotObservedObservation(latest)) {
    return {
      state: "not_observed",
      label: "Not observed",
      current,
      previous,
      latest,
      shareDelta,
    };
  }
  if (!current) {
    return {
      state: "unknown",
      label: "Unknown",
      current,
      previous,
      latest,
      shareDelta,
    };
  }

  if (isNotObservedObservation(rawPrevious)) {
    return {
      state: "resurfaced",
      label: "Resurfaced",
      current,
      previous,
      latest,
      shareDelta,
    };
  }
  if (current.status === "new" || current.direction === "new") {
    return {
      state: "newly_observed",
      label: "Newly observed",
      current,
      previous,
      latest,
      shareDelta,
    };
  }
  if (current.direction === "growing") {
    return { state: "growing", label: "Growing", current, previous, latest, shareDelta };
  }
  if (current.direction === "declining") {
    return { state: "declining", label: "Declining", current, previous, latest, shareDelta };
  }
  if (current.direction === "stable") {
    return { state: "stable", label: "Stable", current, previous, latest, shareDelta };
  }
  return { state: "unknown", label: "Unknown", current, previous, latest, shareDelta };
}

export function changeCounts(
  narratives: NarrativeSummary[],
  periods: NarrativePeriod[],
): Record<"newly_observed" | "growing" | "declining" | "stable" | "not_observed", number> {
  const counts = {
    newly_observed: 0,
    growing: 0,
    declining: 0,
    stable: 0,
    not_observed: 0,
  };
  narratives.forEach((narrative) => {
    const state = narrativePresentation(narrative, periods).state;
    if (state in counts) counts[state as keyof typeof counts] += 1;
  });
  return counts;
}

export function sortNarratives(
  narratives: NarrativeSummary[],
  periods: NarrativePeriod[],
): NarrativeSummary[] {
  return [...narratives].sort((left, right) => {
    const leftView = narrativePresentation(left, periods);
    const rightView = narrativePresentation(right, periods);
    const observed = Number(rightView.current !== null) - Number(leftView.current !== null);
    if (observed !== 0) return observed;
    const prominence = numeric(rightView.current?.prominence) - numeric(leftView.current?.prominence);
    if (prominence !== 0) return prominence;
    const share = numeric(rightView.current?.share_of_voice) - numeric(leftView.current?.share_of_voice);
    if (share !== 0) return share;
    const volume = numeric(rightView.current?.n_mentions) - numeric(leftView.current?.n_mentions);
    if (volume !== 0) return volume;
    return left.name.localeCompare(right.name);
  });
}

export function pointSize(share: number | null | undefined): number {
  if (share == null || !Number.isFinite(share) || share <= 0) return 10;
  return Math.round(Math.min(26, 10 + Math.sqrt(Math.min(share, 1)) * 34));
}

export function observationMomentumTag(
  observation: NarrativeObservation | null | undefined,
): ClusterMomentumTag | null {
  return observation?.momentum ?? null;
}

export function formatShare(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
}

export function formatDeltaPp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const pp = value * 100;
  const sign = pp > 0 ? "+" : pp < 0 ? "−" : "";
  return `${sign}${Math.abs(pp).toFixed(1)}pp`;
}

export function formatPeriodLabel(value: string): string {
  const date = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[3]}` : date;
}

export function describeNarrativeChange(
  narrative: NarrativeSummary,
  periods: NarrativePeriod[],
): string {
  const view = narrativePresentation(narrative, periods);
  if (view.state === "not_observed") {
    return `Not observed in the latest period; last observed ${formatPeriodLabel(narrative.last_observed_at)}.`;
  }
  if (view.state === "unknown") {
    return "No deterministic observation is available for the latest analytical period.";
  }
  if (view.state === "newly_observed") {
    return `First observed in the loaded range on ${formatPeriodLabel(view.current!.period_start)}.`;
  }
  if (view.state === "resurfaced") {
    return "Observed again after a period explicitly recorded as not observed.";
  }
  if (view.shareDelta != null) {
    if (view.shareDelta === 0) {
      return "Mention share held steady from the previous period.";
    }
    const movement = view.shareDelta > 0 ? "increased" : "decreased";
    return `Mention share ${movement} by ${(Math.abs(view.shareDelta) * 100).toFixed(1)}pp from the previous period.`;
  }
  return "Observed in the latest period; no comparable mention-share delta is available.";
}

export function artifactHref(
  period: NarrativePeriod,
  scope: ScopeSelection,
): string {
  const query = new URLSearchParams();
  query.set(scope.kind === "group" ? "group_id" : "topic_id", String(scope.id));
  query.set(
    period.artifact_type === "digest" ? "digest_result_id" : "report_id",
    String(period.artifact_id),
  );
  return `/reports?${query.toString()}`;
}

export function periodForObservation(
  periods: NarrativePeriod[],
  observation: NarrativeObservation,
): NarrativePeriod | null {
  return (
    periods.find(
      (period) =>
        period.period_start === observation.period_start &&
        period.period_end === observation.period_end,
    ) ?? null
  );
}

export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function scalar(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function positiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonEmpty(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function periodKey(period: Pick<NarrativePeriod, "period_start" | "period_end">): string {
  return `${period.period_start}\u0000${period.period_end}`;
}

function numeric(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
