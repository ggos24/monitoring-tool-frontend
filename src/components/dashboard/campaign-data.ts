"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";

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
