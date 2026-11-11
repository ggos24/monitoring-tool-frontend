"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { countChange, formatShare, shareChange, type DateWindow } from "@/lib/period";
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

  const trendTitle = prevLabel;
  // Previous-period row under each card: the change always reads against a
  // visible base. undefined = not comparing; null = no value ("—").
  const prevValue = (q: { isLoading: boolean }, v: string | undefined) =>
    !compare ? undefined : q.isLoading ? "…" : (v ?? null);

  const tier1 = ratio(currentMentions.data?.total, currentPool.data?.total);
  const tier1Prev = ratio(previousMentions.data?.total, previousPool.data?.total);
  const fav = favorableShare(currentFav.data);
  const favPrev = favorableShare(previousFav.data);

  return (
    <div className="grid grid-cols-2 gap-px bg-strong md:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        kicker="Total mentions"
        value={(currentMentions.data?.total ?? 0).toLocaleString()}
        context="all sources"
        previous={prevValue(previousMentions, previousMentions.data?.total.toLocaleString())}
        previousLabel={prevLabel}
        change={compare ? countChange(currentMentions.data?.total, previousMentions.data?.total) : undefined}
        changeTitle={trendTitle}
        isLoading={!enabled || currentMentions.isLoading}
      />
      <KpiCard
        kicker="Share of Tier-1 coverage"
        value={pool === null ? "—" : tier1 === null ? "—" : formatShare(tier1)}
        context={
          pool === null
            ? "Tier-1 pool not configured"
            : `of ${(currentPool.data?.total ?? 0).toLocaleString()} Tier-1 articles`
        }
        previous={
          pool === null
            ? undefined
            : prevValue(previousPool, tier1Prev === null ? undefined : formatShare(tier1Prev))
        }
        previousLabel={prevLabel}
        change={compare ? shareChange(tier1, tier1Prev) : undefined}
        changeTitle={trendTitle}
        isLoading={!enabled || (pool !== null && (currentMentions.isLoading || currentPool.isLoading))}
      />
      <KpiCard
        kicker="Favorable share"
        title={FAVORABILITY_TOOLTIP}
        value={fav === null ? "—" : formatShare(fav)}
        context={`of ${scoredTotal(currentFav.data?.counts).toLocaleString()} analysed`}
        previous={prevValue(previousFav, favPrev === null ? undefined : formatShare(favPrev))}
        previousLabel={prevLabel}
        change={compare ? shareChange(fav, favPrev) : undefined}
        changeTitle={trendTitle}
        isLoading={!enabled || currentFav.isLoading}
      />
      <KpiCard
        kicker="Sources"
        value={(currentSources.data?.count ?? 0).toLocaleString()}
        context="distinct domains"
        previous={prevValue(previousSources, previousSources.data?.count.toLocaleString())}
        previousLabel={prevLabel}
        change={compare ? countChange(currentSources.data?.count, previousSources.data?.count) : undefined}
        changeTitle={trendTitle}
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
