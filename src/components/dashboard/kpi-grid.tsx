"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { KpiCard } from "./kpi-card";

export function KpiGrid({
  brandId,
  days,
}: {
  brandId: number | null;
  days: number;
}) {
  const enabled = brandId !== null;

  const mentionsQuery = useQuery({
    queryKey: ["mentions", brandId, "kpi", days],
    queryFn: () => apiClient.mentions({ brand_id: brandId!, limit: 1 }),
    enabled,
  });

  const brandsQuery = useQuery({
    queryKey: ["brands"],
    queryFn: apiClient.brands,
  });

  const sourcesQuery = useQuery({
    queryKey: ["sources", brandId, days, 100],
    queryFn: () => apiClient.topSources(brandId!, days, 100),
    enabled,
  });

  const totalMentions = mentionsQuery.data?.total ?? 0;
  const activeBrands = brandsQuery.data?.filter((b) => b.is_active).length ?? 0;
  const sourceCount = sourcesQuery.data?.length ?? 0;
  const dailyAvg = days > 0 ? Math.round(totalMentions / days) : 0;

  const isMentionsLoading = enabled && mentionsQuery.isLoading;
  const isSourcesLoading = enabled && sourcesQuery.isLoading;

  return (
    <div className="grid grid-cols-2 gap-px bg-zinc-900 md:grid-cols-4">
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
        subtitle={`distinct domains in ${days}d`}
        isLoading={isSourcesLoading}
      />
      <KpiCard
        kicker="Brands"
        value={activeBrands}
        subtitle="monitored"
        isLoading={brandsQuery.isLoading}
      />
    </div>
  );
}
