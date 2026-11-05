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
