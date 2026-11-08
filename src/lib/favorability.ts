import type { ReportAggregates, ReportBasis, StanceLabel } from "./types";

/**
 * Favorability = how favorable the article's content is to Ukraine.
 * The backend still stores it as `stance_label` (supportive / critical /
 * neutral / mixed); the UI only ever shows these labels.
 */
export const FAVORABILITY_LABEL: Record<StanceLabel, string> = {
  supportive: "Favorable",
  critical: "Unfavorable",
  neutral: "Neutral",
  mixed: "Mixed",
};

export const FAVORABILITY_TOOLTIP =
  "How favorable the article's content is to Ukraine";

/** Fallback thresholds when the backend does not send its own (pre-deploy). */
export const MIN_SCORED = 20;
export const MIN_SCORED_SHARE = 0.5;

/** Count fields shared by /stats/favorability `counts` and the campaign block. */
type CountsLike = {
  favorable: number;
  neutral: number;
  unfavorable: number;
  mixed: number;
  unscored: number;
};

/** Optional readiness fields the backend adds alongside the counts. */
export type FavorabilityReadinessFields = {
  n_scored?: number;
  sufficient?: boolean;
  min_scored?: number;
  min_scored_share?: number;
};

export type FavorabilityReadiness = {
  /** True when shares / mean are meaningful enough to show. */
  ready: boolean;
  scored: number;
  total: number;
  minScored: number;
  minShare: number;
  /** What `total` counts; "eligible" for reports with a coverage basis. */
  basis?: "all" | "eligible";
};

/**
 * Whether favorability shares can be shown. Prefers the backend's
 * `sufficient` flag; without it (older backend) applies the same rule
 * locally: at least `minScored` scored AND at least `minShare` of all
 * articles scored. Prevents "100% favorable" from 2 of 289 articles.
 */
export function favorabilityReadiness(
  counts: CountsLike | null | undefined,
  meta: FavorabilityReadinessFields = {},
): FavorabilityReadiness {
  const minScored = meta.min_scored ?? MIN_SCORED;
  const minShare = meta.min_scored_share ?? MIN_SCORED_SHARE;
  if (!counts) return { ready: false, scored: 0, total: 0, minScored, minShare };
  const scored =
    meta.n_scored ?? counts.favorable + counts.neutral + counts.unfavorable + counts.mixed;
  const total = scored + counts.unscored;
  const ready =
    typeof meta.sufficient === "boolean"
      ? meta.sufficient && scored > 0
      : total > 0 && scored >= minScored && scored / total >= minShare;
  return { ready, scored, total, minScored, minShare };
}

/** One-line muted note for a not-ready favorability block. */
export function insufficientFavorabilityNote(r: FavorabilityReadiness): string {
  const of = r.basis === "eligible" ? "eligible articles" : "all";
  return (
    `Not enough scored articles yet — ${r.scored.toLocaleString("en-US")} of ` +
    `${r.total.toLocaleString("en-US")} ${r.basis === "eligible" ? "eligible " : ""}scored. ` +
    `Shares appear once at least ${r.minScored} articles and ` +
    `${formatMinShare(r.minShare)} of ${of} are scored.`
  );
}

/**
 * Min-n guard for a report's favorability shares. `scored` is the sum of
 * `sentiment_distribution`. The share rule needs a denominator beyond the
 * enriched rows the report reads: when the report carries a coverage basis
 * (selected scope, falling back to the legacy flat block) it is the
 * enrichment-gate-eligible total, since only gate-eligible rows are ever
 * scored. Legacy reports without a basis fall back to `n_mentions`.
 */
export function reportFavorabilityReadiness(
  aggregates: ReportAggregates,
): FavorabilityReadiness {
  const d = aggregates.sentiment_distribution ?? {};
  const counts = {
    favorable: d.supportive ?? 0,
    neutral: d.neutral ?? 0,
    unfavorable: d.critical ?? 0,
    mixed: d.mixed ?? 0,
    unscored: 0,
  };
  const scored = counts.favorable + counts.neutral + counts.unfavorable + counts.mixed;
  const basis: ReportBasis | undefined =
    aggregates.selected_scope_basis ??
    aggregates.data_basis?.selected_scope_basis ??
    aggregates.data_basis;
  if (basis && typeof basis.eligible_total === "number" && basis.eligible_total > 0) {
    const total = basis.eligible_total;
    const eligibleScored = Math.min(total, basis.eligible_enriched_total ?? scored);
    return {
      ready: scored >= MIN_SCORED && eligibleScored / total >= MIN_SCORED_SHARE,
      scored: eligibleScored,
      total,
      minScored: MIN_SCORED,
      minShare: MIN_SCORED_SHARE,
      basis: "eligible",
    };
  }
  counts.unscored = Math.max(0, (aggregates.n_mentions ?? 0) - scored);
  return favorabilityReadiness(counts);
}

function formatMinShare(share: number): string {
  return share === 0.5 ? "half" : `${Math.round(share * 100)}%`;
}
