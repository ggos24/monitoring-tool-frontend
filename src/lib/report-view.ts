import type {
  ClusterMomentumTag,
  Report,
  ReportAggregates,
  ReportBasis,
  ReportClusterSummary,
  ReportEvidenceRef,
  ReportType,
  SegmentCondition,
} from "./types";

export const DEFAULT_REPORT_TYPE: ReportType = "intelligence_brief";

export type BriefSections = {
  bottomLine: string | null;
  bullets: string[];
  trends: string | null;
  watchlist: string[];
  caveats: string | null;
  hasStructuredContent: boolean;
};

type BriefConvenienceFields = Pick<
  Report,
  "bottom_line" | "bluf_bullets" | "trends" | "watchlist" | "caveats"
>;

export function resolveReportType(
  explicit: ReportType | undefined,
  params: Record<string, unknown> | null | undefined,
  aggregates: ReportAggregates | null | undefined,
): ReportType {
  if (explicit === "intelligence_brief" || explicit === "executive") {
    return explicit;
  }
  const fromParams = params?.report_type;
  if (fromParams === "intelligence_brief" || fromParams === "executive") {
    return fromParams;
  }
  // Rolling-deploy and scheduled-result fallback: structured brief fields
  // are unambiguous even when the row predates the report_type response field.
  if (
    aggregates?.bottom_line ||
    (aggregates?.bluf_bullets?.length ?? 0) > 0 ||
    aggregates?.trends ||
    (aggregates?.watchlist?.length ?? 0) > 0 ||
    aggregates?.caveats
  ) {
    return "intelligence_brief";
  }
  return "executive";
}

export function reportTypeLabel(reportType: ReportType): string {
  return reportType === "intelligence_brief"
    ? "Intelligence brief"
    : "Executive report (legacy)";
}

export function resolveBriefSections(
  aggregates: ReportAggregates | null | undefined,
  convenience: Partial<BriefConvenienceFields> | null | undefined,
): BriefSections {
  const bottomLine = nonEmpty(convenience?.bottom_line) ?? nonEmpty(aggregates?.bottom_line);
  const convenienceBullets = cleanList(convenience?.bluf_bullets);
  const bullets = convenienceBullets.length
    ? convenienceBullets
    : cleanList(aggregates?.bluf_bullets);
  const trends = nonEmpty(convenience?.trends) ?? nonEmpty(aggregates?.trends);
  const convenienceWatchlist = cleanList(convenience?.watchlist);
  const watchlist = convenienceWatchlist.length
    ? convenienceWatchlist
    : cleanList(aggregates?.watchlist);
  const caveats = nonEmpty(convenience?.caveats) ?? nonEmpty(aggregates?.caveats);
  return {
    bottomLine,
    bullets,
    trends,
    watchlist,
    caveats,
    hasStructuredContent: Boolean(
      bottomLine || bullets.length || trends || watchlist.length || caveats,
    ),
  };
}

export function selectedReportBasis(
  aggregates: ReportAggregates | null | undefined,
): ReportBasis | null {
  return (
    aggregates?.selected_scope_basis ??
    aggregates?.data_basis?.selected_scope_basis ??
    aggregates?.data_basis ??
    null
  );
}

export function corpusReportBasis(
  aggregates: ReportAggregates | null | undefined,
): ReportBasis | null {
  return (
    aggregates?.topic_corpus_basis ??
    aggregates?.data_basis?.topic_corpus_basis ??
    null
  );
}

export function rankNarratives(
  clusters: ReportClusterSummary[],
): ReportClusterSummary[] {
  return [...clusters].sort((left, right) => {
    const prominence = numeric(right.prominence) - numeric(left.prominence);
    if (prominence !== 0) return prominence;
    const share = numeric(right.share_of_voice) - numeric(left.share_of_voice);
    if (share !== 0) return share;
    const volume = right.n_mentions - left.n_mentions;
    if (volume !== 0) return volume;
    return left.cluster_id - right.cluster_id;
  });
}

export function clusterTitle(cluster: ReportClusterSummary, rank?: number): string {
  // Prose name first: the heading is the scan target, and `handle` is a
  // machine slug (`ukraine-air-defense-overwhelmed`) that reads slowly and is
  // not even consistently delimited across model outputs. The slug stays
  // reachable via `clusterHandle` as a secondary identifier line.
  return (
    nonEmpty(cluster.name) ??
    nonEmpty(cluster.label) ??
    nonEmpty(cluster.handle) ??
    nonEmpty(cluster.claim) ??
    `Narrative ${rank ?? cluster.cluster_id + 1}`
  );
}

/** Stable slug for a narrative, only when it adds something to the heading. */
export function clusterHandle(cluster: ReportClusterSummary): string | null {
  const handle = nonEmpty(cluster.handle);
  if (!handle) return null;
  return handle === clusterTitle(cluster) ? null : handle;
}

export function clusterMomentumTag(
  cluster: ReportClusterSummary,
): ClusterMomentumTag | null {
  if (cluster.momentum_tag) return cluster.momentum_tag;
  if (cluster.momentum && typeof cluster.momentum === "object") {
    return cluster.momentum.tag;
  }
  if (cluster.momentum === "rising") return "building";
  if (cluster.momentum === "falling") return "fading";
  if (cluster.momentum === "flat") return "steady";
  return null;
}

export function clusterSlopeRatio(cluster: ReportClusterSummary): number | null {
  return cluster.momentum && typeof cluster.momentum === "object"
    ? cluster.momentum.slope_ratio
    : null;
}

export function evidenceRefText(ref: ReportEvidenceRef): string {
  return nonEmpty(ref.quote) ?? nonEmpty(ref.text) ?? nonEmpty(ref.title) ?? "Source";
}

export function isVerbatimEvidence(ref: ReportEvidenceRef): boolean {
  return (
    ref.verified_verbatim === true &&
    (ref.evidence_type === "direct_quote" || ref.evidence_type === "verbatim_quote")
  );
}

export function formatUtcDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatUtcDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

export function formatReportWindow(params: Record<string, unknown>): string {
  const from = typeof params.date_from === "string" ? params.date_from : null;
  const to = typeof params.date_to === "string" ? params.date_to : null;
  if (!from && !to) return "All available enriched mentions";
  return `${from ? formatUtcDateTime(from) : "start"} → ${
    to ? formatUtcDateTime(to) : "now"
  }`;
}

export function reportFilters(params: Record<string, unknown>): SegmentCondition[] {
  if (!Array.isArray(params.filters)) return [];
  return params.filters.filter(isSegmentCondition);
}

export function formatReportFilter(condition: SegmentCondition): string {
  const field = FIELD_LABELS[condition.field] ?? condition.field.replaceAll("_", " ");
  const op = OP_LABELS[condition.op] ?? condition.op;
  const value = Array.isArray(condition.value)
    ? condition.value.map(formatFilterValue).join(", ")
    : formatFilterValue(condition.value);
  return `${field} ${op} ${value}`;
}

function isSegmentCondition(value: unknown): value is SegmentCondition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.field === "string" &&
    typeof candidate.op === "string" &&
    "value" in candidate
  );
}

function formatFilterValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function cleanList(values: string[] | null | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numeric(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const FIELD_LABELS: Record<string, string> = {
  topic_id: "Topic",
  country: "Source country",
  source_id: "Source",
  source_score: "Trust score",
  is_propaganda: "Propaganda source",
  language: "Language",
  stance_label: "Stance",
  framing_label: "Framing",
};

const OP_LABELS: Record<string, string> = {
  "=": "is",
  "!=": "is not",
  ">=": "at least",
  "<=": "at most",
  in: "is one of",
};
