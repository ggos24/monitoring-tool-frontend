"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { countryName, iso2ToFlagEmoji } from "@/lib/country";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";

// Fills the 4th KPI slot (previously "Topics monitored", which duplicated the
// scope selector). Shows the top publishing countries for the current scope +
// period. Shares the ["countries", scope, days] query with CountryFilter, so
// this card adds no extra request.
export function TopGeoCard({
  scope,
  days,
}: {
  scope: ScopeParam | null;
  days: number;
}) {
  const enabled = scope !== null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["countries", scope, days],
    queryFn: () => apiClient.countries(scope!, days, 100),
    enabled,
    staleTime: 60_000,
  });

  // Denominator includes the null/unknown bucket so the shares reflect the
  // true total; the ranking itself excludes unknown-origin mentions.
  const total = (data ?? []).reduce((sum, c) => sum + c.count, 0);
  const top = (data ?? []).filter((c) => c.iso2).slice(0, 3);

  return (
    <div className="bg-card p-5">
      <KickerLabel>Top countries</KickerLabel>

      {!enabled || isLoading ? (
        <div className="mt-3 space-y-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-3 font-mono text-[11px] text-text-tertiary">
          Failed to load.
        </div>
      ) : top.length === 0 ? (
        <div className="mt-3 font-mono text-[11px] text-text-tertiary">
          No country data yet.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {top.map((c) => {
            const pct = total > 0 ? Math.round((c.count / total) * 100) : 0;
            return (
              <div key={c.iso2} className="flex items-center gap-2">
                <span aria-hidden className="text-[14px] leading-none">
                  {iso2ToFlagEmoji(c.iso2)}
                </span>
                <span className="w-6 font-mono text-[11px] text-text-tertiary">
                  {c.iso2}
                </span>
                <span className="flex-1 truncate text-xs text-text-secondary">
                  {countryName(c.iso2)}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-foreground">
                  {c.count.toLocaleString()}
                </span>
                <span className="w-9 text-right font-mono text-[11px] tabular-nums text-text-tertiary">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 font-mono text-[11px] text-text-tertiary">
        by mentions, last {days}d
      </div>
    </div>
  );
}
