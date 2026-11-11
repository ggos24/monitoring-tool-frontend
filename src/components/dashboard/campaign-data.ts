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

/**
 * The figures a window is COMPARED by: only the sources that already
 * covered the earlier window, so a newly added source doesn't read as
 * growth. null = no source covers it (show no change). Older backend:
 * its GKG headline, which is like-for-like by construction.
 */
export function comparableTotals(
  h: CampaignHeadline | undefined,
): CampaignTotals | null | undefined {
  if (!h) return undefined;
  return h.all_sources ? h.all_sources.comparable : h.headline;
}

const LANE_LABEL: Record<string, string> = {
  gkg: "GDELT",
  gdelt: "GDELT search",
  google_news_rss: "Google News",
  rss: "RSS",
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
