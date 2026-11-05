"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { computeTrend, effectiveRanges, formatDayLabel } from "@/lib/period";
import { KpiCard } from "./kpi-card";
import { TopGeoCard } from "./top-geo-card";

export function KpiGrid({
  compare,
  scope,
  days,
  country,
  selectedDay,
}: {
  /** Show Δ% + the previous window's absolute value under each card. */
  compare: boolean;
  scope: ScopeParam | null;
  days: number;
  country: string | null;
  selectedDay: string | null;
}) {
  const enabled = scope !== null;
  // Current + previous windows: the selected period and the one before it,
  // or a single drilled-down day and the day before it.
  const { curFrom, curTo, prevFrom, prevTo } = effectiveRanges(days, selectedDay);

  const currentMentions = useQuery({
    queryKey: ["mentions-kpi", scope, country, curFrom, curTo],
    queryFn: () =>
      apiClient.mentions({
        scope: scope!,
        limit: 1,
        country_iso2: country ?? undefined,
        date_from: curFrom,
        date_to: curTo,
      }),
    enabled,
  });

  const previousMentions = useQuery({
    queryKey: ["mentions-kpi-prev", scope, country, prevFrom, prevTo],
    queryFn: () =>
      apiClient.mentions({
        scope: scope!,
        limit: 1,
        country_iso2: country ?? undefined,
        date_from: prevFrom,
        date_to: prevTo,
      }),
    enabled: enabled && compare,
  });

  // Distinct-source count is now period-scoped + country-aware (exact, no
  // "50+" cap) via /stats/sources/count, so it earns a delta like the rest.
  const currentSources = useQuery({
    queryKey: ["sources-count", scope, country, curFrom, curTo],
    queryFn: () =>
      apiClient.sourcesCount(scope!, {
        country_iso2: country,
        date_from: curFrom,
        date_to: curTo,
      }),
    enabled,
  });

  const previousSources = useQuery({
    queryKey: ["sources-count-prev", scope, country, prevFrom, prevTo],
    queryFn: () =>
      apiClient.sourcesCount(scope!, {
        country_iso2: country,
        date_from: prevFrom,
        date_to: prevTo,
      }),
    enabled: enabled && compare,
  });

  const totalMentions = currentMentions.data?.total ?? 0;
  const sourceCount = currentSources.data?.count ?? 0;
  const effectiveDays = selectedDay ? 1 : days;
  const dailyAvg =
    effectiveDays > 0 ? Math.round(totalMentions / effectiveDays) : 0;

  const mentionsTrend = computeTrend(
    currentMentions.data?.total,
    previousMentions.data?.total,
  );
  const sourcesTrend = computeTrend(
    currentSources.data?.count,
    previousSources.data?.count,
  );
  const trendTitle = selectedDay ? "vs previous day" : `vs previous ${days}d`;
  const periodSubtitle = selectedDay ? formatDayLabel(selectedDay) : `last ${days}d`;
  const prevLabel = selectedDay ? "prev day" : `prev ${days}d`;
  // "· prev 1,234" suffix — the previous window's absolute value, so the
  // Δ% always reads against a visible base.
  const prevSuffix = (n: number | undefined) =>
    compare && n !== undefined ? ` · ${prevLabel} ${n.toLocaleString()}` : "";
  const prevMentions = previousMentions.data?.total;
  const prevDailyAvg =
    prevMentions !== undefined && effectiveDays > 0
      ? Math.round(prevMentions / effectiveDays)
      : undefined;

  // Treat "no scope yet" (initial load, before the first topic auto-selects)
  // as loading so the whole grid shows skeletons instead of a blank flash.
  const isMentionsLoading = !enabled || currentMentions.isLoading;
  const isSourcesLoading = !enabled || currentSources.isLoading;

  return (
    <div className="grid grid-cols-2 gap-px bg-strong md:grid-cols-4">
      <KpiCard
        kicker="Total mentions"
        value={totalMentions.toLocaleString()}
        subtitle={periodSubtitle + prevSuffix(prevMentions)}
        trend={compare ? mentionsTrend : undefined}
        trendTitle={trendTitle}
        isLoading={isMentionsLoading}
      />
      <KpiCard
        kicker="Daily average"
        value={dailyAvg.toLocaleString()}
        subtitle={"per day" + prevSuffix(prevDailyAvg)}
        trend={compare ? mentionsTrend : undefined}
        trendTitle={trendTitle}
        isLoading={isMentionsLoading}
      />
      <KpiCard
        kicker="Sources"
        value={sourceCount.toLocaleString()}
        subtitle={"distinct domains" + prevSuffix(previousSources.data?.count)}
        trend={compare ? sourcesTrend : undefined}
        trendTitle={trendTitle}
        isLoading={isSourcesLoading}
      />
      <TopGeoCard scope={scope} days={days} selectedDay={selectedDay} />
    </div>
  );
}
