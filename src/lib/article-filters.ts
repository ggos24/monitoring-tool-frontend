import { FAVORABILITY_LABEL } from "./favorability.ts";
import type { StanceLabel } from "./types";

/**
 * The article-list filters every Overview panel follows: favorability
 * (stance), collector (source) and the outlet picked in Top media. Country,
 * period and day sit in the toolbar and are already visible there.
 */
export type StanceFilter = "all" | StanceLabel;
export type SourceFilter = "all" | "gn" | "gdelt" | "firehose" | "rss";

export const SOURCE_LABEL: Record<Exclude<SourceFilter, "all">, string> = {
  gn: "Google News",
  gdelt: "GDELT",
  firehose: "Firehose",
  rss: "RSS",
};

export const STANCE_FILTERS: readonly StanceFilter[] = [
  "all",
  "supportive",
  "critical",
  "neutral",
  "mixed",
];

/** Labels of the active filters, in the order the article list shows them. */
export function activeFilterLabels(f: {
  stance?: StanceFilter;
  source?: SourceFilter;
  domain?: string | null;
}): string[] {
  const out: string[] = [];
  if (f.stance && f.stance !== "all") out.push(FAVORABILITY_LABEL[f.stance]);
  if (f.source && f.source !== "all") out.push(SOURCE_LABEL[f.source]);
  if (f.domain) out.push(f.domain.replace(/^www\./i, ""));
  return out;
}
