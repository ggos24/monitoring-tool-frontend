"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { KpiCard } from "./kpi-card";

export function KpiGrid({
  topicId,
  days,
}: {
  topicId: number | null;
  days: number;
}) {
  const enabled = topicId !== null;

  const mentionsQuery = useQuery({
    queryKey: ["mentions", topicId, "kpi", days],
    queryFn: () => apiClient.mentions({ topic_id: topicId!, limit: 1 }),
    enabled,
  });

  const topicsQuery = useQuery({
    queryKey: ["topics"],
    queryFn: apiClient.topics,
  });

  const overviewQuery = useQuery({
    queryKey: ["overview", topicId],
    queryFn: () => apiClient.overview(topicId!),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const totalMentions = mentionsQuery.data?.total ?? 0;
  const activeTopics = topicsQuery.data?.filter((t) => t.is_active).length ?? 0;
  const sourceCount = overviewQuery.data?.total_sources ?? 0;
  const dailyAvg = days > 0 ? Math.round(totalMentions / days) : 0;

  const isMentionsLoading = enabled && mentionsQuery.isLoading;
  const isSourcesLoading = enabled && overviewQuery.isLoading;

  return (
    <div className="grid grid-cols-2 gap-px bg-zinc-800 md:grid-cols-4">
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
