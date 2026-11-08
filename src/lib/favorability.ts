import type { StanceLabel } from "./types";

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
  return (
    `Not enough scored articles yet — ${r.scored.toLocaleString("en-US")} of ` +
    `${r.total.toLocaleString("en-US")} scored. Shares appear once at least ` +
    `${r.minScored} articles and ${formatMinShare(r.minShare)} of all are scored.`
  );
}

function formatMinShare(share: number): string {
  return share === 0.5 ? "half" : `${Math.round(share * 100)}%`;
}
