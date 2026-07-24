"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { computeTrend, periodRange } from "@/lib/period";
import { KpiCard } from "./kpi-card";
import { TopGeoCard } from "./top-geo-card";

export function KpiGrid({
  scope,
  days,
  country,
}: {
  scope: ScopeParam | null;
  days: number;
  country: string | null;
}) {
  const enabled = scope !== null;
  const { from, prevFrom, prevTo } = periodRange(days);

  // Total mentions is now scoped to the selected period (matching the
  // "last Nd" label) so the previous-period delta below is meaningful.
  const currentQuery = useQuery({
    queryKey: ["mentions", scope, "kpi", days, country, from],
    queryFn: () =>
      apiClient.mentions({
        scope: scope!,
        limit: 1,
        country_iso2: country ?? undefined,
        date_from: from,
      }),
    enabled,
  });

  const previousQuery = useQuery({
    queryKey: ["mentions", scope, "kpi-prev", days, country, prevFrom, prevTo],
    queryFn: () =>
      apiClient.mentions({
        scope: scope!,
        limit: 1,
        country_iso2: country ?? undefined,
        date_from: prevFrom,
        date_to: prevTo,
      }),
    enabled,
  });

  // /api/stats/overview is NOT country-aware. When a country filter is
  // active we approximate distinct-source count from /api/stats/sources;
  // backend caps that endpoint at limit=50, so the KPI tops out at "50+".
  // Follow-up: ask backend to accept country_iso2 on /api/stats/overview
  // for an exact count.
  const overviewQuery = useQuery({
    queryKey: ["overview", scope],
    queryFn: () => apiClient.overview(scope!),
    enabled: enabled && country === null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const SOURCES_CAP = 50;
  const filteredSourcesQuery = useQuery({
    queryKey: ["sources-count", scope, days, country],
    queryFn: () => apiClient.topSources(scope!, days, SOURCES_CAP, country),
    enabled: enabled && country !== null,
    staleTime: 30_000,
  });

  const totalMentions = currentQuery.data?.total ?? 0;
  const previousMentions = previousQuery.data?.total;
  const filteredCount = filteredSourcesQuery.data?.length ?? 0;
  const sourceCount =
    country === null
      ? (overviewQuery.data?.total_sources ?? 0)
      : filteredCount >= SOURCES_CAP
        ? `${SOURCES_CAP}+`
        : filteredCount;
  const dailyAvg = days > 0 ? Math.round(totalMentions / days) : 0;

  // Same percentage drives both Total mentions and Daily average — the daily
  // average is just the period total divided by a constant (days).
  const trend = computeTrend(currentQuery.data?.total, previousMentions);
  const trendTitle = `vs previous ${days}d`;

  const isMentionsLoading = enabled && currentQuery.isLoading;
  const isSourcesLoading =
    enabled &&
    (country === null ? overviewQuery.isLoading : filteredSourcesQuery.isLoading);

  return (
    <div className="grid grid-cols-2 gap-px bg-strong md:grid-cols-4">
      <KpiCard
        kicker="Total mentions"
        value={totalMentions.toLocaleString()}
        subtitle={`last ${days}d`}
        trend={trend}
        trendTitle={trendTitle}
        isLoading={isMentionsLoading}
      />
      <KpiCard
        kicker="Daily average"
        value={dailyAvg.toLocaleString()}
        subtitle="per day"
        trend={trend}
        trendTitle={trendTitle}
        isLoading={isMentionsLoading}
      />
      <KpiCard
        kicker="Sources"
        value={sourceCount}
        subtitle="distinct domains"
        isLoading={isSourcesLoading}
      />
      <TopGeoCard scope={scope} days={days} />
    </div>
  );
}
