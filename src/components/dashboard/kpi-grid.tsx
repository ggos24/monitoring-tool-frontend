"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { computeTrend, formatPpDelta, type DateWindow } from "@/lib/period";
import { FAVORABILITY_TOOLTIP } from "@/lib/favorability";
import { KpiCard } from "./kpi-card";
import { TopGeoCard } from "./top-geo-card";
import { favorableShare, scoredTotal, useFavorability } from "./favorability-panel";

export function KpiGrid({
  compare,
  scope,
  win,
  country,
  poolTopicId,
}: {
  /** Show Δ + the previous window's value under each card. */
  compare: boolean;
  scope: ScopeParam | null;
  win: DateWindow;
  country: string | null;
  /** Hidden Tier-1 pool topic — denominator for share of coverage. */
  poolTopicId: number | null;
}) {
  const enabled = scope !== null;
  const { from, to, prevFrom, prevTo, prevLabel } = win;

  const mentionTotal = (s: ScopeParam, f: string, t: string, on: boolean) => ({
    queryKey: ["mentions-kpi", s, country, f, t],
    queryFn: () =>
      apiClient.mentions({
        scope: s,
        limit: 1,
        country_iso2: country ?? undefined,
        date_from: f,
        date_to: t,
      }),
    enabled: on,
  });

  const currentMentions = useQuery(mentionTotal(scope!, from, to, enabled));
  const previousMentions = useQuery(mentionTotal(scope!, prevFrom, prevTo, enabled && compare));

  // Share of Tier-1 coverage = narrative articles ÷ all Tier-1 pool articles
  // in the same window (and country). Group scope is already deduplicated.
  const pool = poolTopicId !== null ? { topic_id: poolTopicId } : null;
  const currentPool = useQuery(mentionTotal(pool!, from, to, enabled && pool !== null));
  const previousPool = useQuery(
    mentionTotal(pool!, prevFrom, prevTo, enabled && compare && pool !== null),
  );

  const currentFav = useFavorability(scope, from, to, country);
  const previousFav = useFavorability(scope, prevFrom, prevTo, country, compare);

  const currentSources = useQuery({
    queryKey: ["sources-count", scope, country, from, to],
    queryFn: () =>
      apiClient.sourcesCount(scope!, { country_iso2: country, date_from: from, date_to: to }),
    enabled,
  });
  const previousSources = useQuery({
    queryKey: ["sources-count", scope, country, prevFrom, prevTo],
    queryFn: () =>
      apiClient.sourcesCount(scope!, {
        country_iso2: country,
        date_from: prevFrom,
        date_to: prevTo,
      }),
    enabled: enabled && compare,
  });

  const trendTitle = `vs ${prevLabel}`;
  // "· prev 7d 1,234" suffix — the previous window's value, so the Δ
  // always reads against a visible base.
  const prevSuffix = (v: string | undefined) => (compare && v !== undefined ? ` · ${prevLabel} ${v}` : "");

  const tier1 = ratio(currentMentions.data?.total, currentPool.data?.total);
  const tier1Prev = ratio(previousMentions.data?.total, previousPool.data?.total);
  const fav = favorableShare(currentFav.data?.counts);
  const favPrev = favorableShare(previousFav.data?.counts);

  return (
    <div className="grid grid-cols-2 gap-px bg-strong md:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        kicker="Total mentions"
        value={(currentMentions.data?.total ?? 0).toLocaleString()}
        subtitle={win.label + prevSuffix(previousMentions.data?.total.toLocaleString())}
        trend={compare ? computeTrend(currentMentions.data?.total, previousMentions.data?.total) : undefined}
        trendTitle={trendTitle}
        isLoading={!enabled || currentMentions.isLoading}
      />
      <KpiCard
        kicker="Share of Tier-1 coverage"
        value={pool === null ? "—" : tier1 === null ? "—" : formatShare(tier1)}
        subtitle={
          pool === null
            ? "Tier-1 pool not configured"
            : `of ${(currentPool.data?.total ?? 0).toLocaleString()} Tier-1 articles` +
              prevSuffix(tier1Prev === null ? undefined : formatShare(tier1Prev))
        }
        delta={compare && tier1 !== null && tier1Prev !== null ? formatPpDelta(tier1, tier1Prev) : undefined}
        trendTitle={trendTitle}
        isLoading={!enabled || (pool !== null && (currentMentions.isLoading || currentPool.isLoading))}
      />
      <KpiCard
        kicker="Favorable share"
        title={FAVORABILITY_TOOLTIP}
        value={fav === null ? "—" : formatShare(fav)}
        subtitle={
          `of ${scoredTotal(currentFav.data?.counts).toLocaleString()} scored` +
          prevSuffix(favPrev === null ? undefined : formatShare(favPrev))
        }
        delta={compare && fav !== null && favPrev !== null ? formatPpDelta(fav, favPrev) : undefined}
        trendTitle={trendTitle}
        isLoading={!enabled || currentFav.isLoading}
      />
      <KpiCard
        kicker="Sources"
        value={(currentSources.data?.count ?? 0).toLocaleString()}
        subtitle={"distinct domains" + prevSuffix(previousSources.data?.count.toLocaleString())}
        trend={compare ? computeTrend(currentSources.data?.count, previousSources.data?.count) : undefined}
        trendTitle={trendTitle}
        isLoading={!enabled || currentSources.isLoading}
      />
      <TopGeoCard scope={scope} win={win} compare={compare} />
    </div>
  );
}

function ratio(num: number | undefined, den: number | undefined): number | null {
  if (num === undefined || den === undefined || den === 0) return null;
  return num / den;
}

function formatShare(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
