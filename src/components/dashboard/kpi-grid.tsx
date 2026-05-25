"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { KpiCard } from "./kpi-card";

export function KpiGrid({
  topicId,
  days,
  country,
}: {
  topicId: number | null;
  days: number;
  country: string | null;
}) {
  const enabled = topicId !== null;

  const mentionsQuery = useQuery({
    queryKey: ["mentions", topicId, "kpi", days, country],
    queryFn: () =>
      apiClient.mentions({
        topic_id: topicId!,
        limit: 1,
        country_iso2: country ?? undefined,
      }),
    enabled,
  });

  const topicsQuery = useQuery({
    queryKey: ["topics"],
    queryFn: apiClient.topics,
  });

  // /api/stats/overview is NOT country-aware. When a country filter is
  // active we approximate distinct-source count from /api/stats/sources;
  // backend caps that endpoint at limit=50, so the KPI tops out at "50+".
  // Follow-up: ask backend to accept country_iso2 on /api/stats/overview
  // for an exact count.
  const overviewQuery = useQuery({
    queryKey: ["overview", topicId],
    queryFn: () => apiClient.overview(topicId!),
    enabled: enabled && country === null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const SOURCES_CAP = 50;
  const filteredSourcesQuery = useQuery({
    queryKey: ["sources-count", topicId, days, country],
    queryFn: () => apiClient.topSources(topicId!, days, SOURCES_CAP, country),
    enabled: enabled && country !== null,
    staleTime: 30_000,
  });

  const totalMentions = mentionsQuery.data?.total ?? 0;
  const activeTopics = topicsQuery.data?.filter((t) => t.is_active).length ?? 0;
  const filteredCount = filteredSourcesQuery.data?.length ?? 0;
  const sourceCount =
    country === null
      ? (overviewQuery.data?.total_sources ?? 0)
      : filteredCount >= SOURCES_CAP
        ? `${SOURCES_CAP}+`
        : filteredCount;
  const dailyAvg = days > 0 ? Math.round(totalMentions / days) : 0;

  const isMentionsLoading = enabled && mentionsQuery.isLoading;
  const isSourcesLoading =
    enabled &&
    (country === null ? overviewQuery.isLoading : filteredSourcesQuery.isLoading);

  return (
    <div className="grid grid-cols-2 gap-px bg-strong md:grid-cols-4">
      <KpiCard
        kicker="Total mentions"
        value={totalMentions.toLocaleString()}
        subtitle={`last ${days}d`}
        isLoading={isMentionsLoading}
      />
      <KpiCard
        kicker="Daily average"
        value={dailyAvg.toLocaleString()}
        subtitle="per day"
        isLoading={isMentionsLoading}
      />
      <KpiCard
        kicker="Sources"
        value={sourceCount}
        subtitle="distinct domains"
        isLoading={isSourcesLoading}
      />
      <KpiCard
        kicker="Topics"
        value={activeTopics}
        subtitle="monitored"
        isLoading={topicsQuery.isLoading}
      />
    </div>
  );
}
