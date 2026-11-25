"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import { formatDayLabel, type DateWindow } from "@/lib/period";
import type {
  CampaignHeadline,
  CampaignSourceLane,
  CampaignTotals,
  ScopeParam,
} from "@/lib/types";

/** True when the backend simply doesn't have the endpoint (older deploy). */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Size of the Tier-1 network ("of 93 Tier-1 media"); null when unknown. */
export function tier1NetworkSize(cov: ReturnType<typeof useCampaignCoverage>["data"]): number | null {
  return cov?.available
    ? (cov.counts.visible ?? 0) + (cov.counts.sparse ?? 0) + (cov.counts.invisible ?? 0)
    : null;
}

/**
 * GET /api/campaign/coverage — shared by the footnote and the KPI grid
 * (its `selector_version` is passed verbatim to both headline windows).
 */
export function useCampaignCoverage() {
  return useQuery({
    queryKey: ["campaign-coverage"],
    queryFn: apiClient.campaignCoverage,
    staleTime: 60 * 60_000,
    retry: (count, error) => !isNotFound(error) && count < 1,
  });
}

/**
 * GET /api/campaign/headline for the window and, when comparing, the
 * previous one. Both calls carry the coverage selector version and the same
 * `compare_from` (the previous window's start), so their like-for-like
 * figures cover the same sources. Shared by the KPI grid and the timeline
 * header — same key, one request.
 */
export function useCampaignHeadlines(
  scope: ScopeParam | null,
  win: DateWindow,
  country: string | null,
  compare: boolean,
) {
  const coverage = useCampaignCoverage();
  // Wait for coverage to settle so the first headline call already carries
  // the selector version (no second request when it arrives).
  const coverageSettled = coverage.isSuccess || coverage.isError;
  const selector = coverage.data?.selector_version ?? null;
  const compareFrom = compare ? win.prevFrom : null;

  const fetchWindow = (from: string, to: string, on: boolean) => ({
    queryKey: ["campaign-headline", scope, country, selector, compareFrom, from, to],
    queryFn: () =>
      apiClient.campaignHeadline(scope!, {
        date_from: from,
        date_to: to,
        selector_version: selector,
        country_iso2: country,
        compare_from: compareFrom,
      }),
    enabled: scope !== null && coverageSettled && on,
    // Old figures stay on screen (dimmed) while the next window loads. Only
    // for a query that is on: a disabled one must not show stale data.
    placeholderData: on ? keepPreviousData : undefined,
    retry: (count: number, error: unknown) => !isNotFound(error) && count < 1,
  });
  const current = useQuery(fetchWindow(win.from, win.to, true));
  const previous = useQuery(fetchWindow(win.prevFrom, win.prevTo, compare));
  return { coverage, coverageSettled, current, previous };
}

/** The figures a window SHOWS: all sources; GKG-only on an older backend. */
export function shownTotals(h: CampaignHeadline | undefined): CampaignTotals | undefined {
  return h?.all_sources ?? h?.headline;
}

const LANE_LABEL: Record<string, string> = {
  gkg: "GDELT",
  gdelt: "GDELT search",
  google_news_rss: "Google News",
  rss: "RSS",
  news_sitemap: "news sitemaps",
  sitemap_archive: "sitemap archives",
};
export function laneLabel(code: string): string {
  return LANE_LABEL[code] ?? code;
}

/** Sources with articles in the window that the change does NOT count. */
export function excludedLanes(h: CampaignHeadline | undefined): CampaignSourceLane[] {
  return (h?.all_sources?.by_source ?? []).filter((l) => l.comparable === false && l.articles > 0);
}

/** "Google News (since Nov 11) and RSS (since Nov 11)" */
export function excludedLanesText(lanes: CampaignSourceLane[]): string {
  const parts = lanes.map(
    (l) => laneLabel(l.code) + (l.comparable_since ? ` (collected since ${formatDayLabel(l.comparable_since)})` : ""),
  );
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Owner decision 2026-11-25: when a source started collecting inside the
 * compared range, the previous period has fewer sources and any change
 * would mislead — show no change at all (badges hidden) instead of a
 * like-for-like subset that does not match the numbers on screen.
 * Same queries (and cache) as the KPI grid.
 */
export function useSourcesDiffer(
  scope: ScopeParam | null,
  win: DateWindow,
  country: string | null,
  compare: boolean,
): { differ: boolean; note: string } {
  const { current } = useCampaignHeadlines(scope, win, country, compare);
  const excluded = compare ? excludedLanes(current.data) : [];
  // Unknown until the headline lands: hide rather than flash a badge.
  const unknown = compare && !current.data && !current.error;
  return { differ: unknown || excluded.length > 0, note: sourcesDifferNote(excluded) };
}

export function sourcesDifferNote(excluded: CampaignSourceLane[]): string {
  if (!excluded.length) return "";
  const names = excluded.map((l) => laneLabel(l.code));
  const list = names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const since = excluded.map((l) => l.comparable_since).filter(Boolean).sort().at(-1);
  return (
    `No change shown: ${list} ${names.length > 1 ? "were" : "was"} added` +
    (since ? ` on ${formatDayLabel(since)}` : "") +
    ", so the previous period has fewer sources. The change returns once both periods have the same sources."
  );
}
