"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { countryName, iso2ToFlagEmoji } from "@/lib/country";
import { countChange, type DateWindow } from "@/lib/period";
import { ChangeBadge } from "./kpi-card";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Top publishing countries for the current scope + window. Shares the
// ["countries", …] query with CountryFilter, so the current window adds no
// extra request; with `compare` on, one more call fetches the previous
// window for the per-country Δ.
export function TopGeoCard({
  scope,
  win,
  compare,
}: {
  scope: ScopeParam | null;
  win: DateWindow;
  compare: boolean;
}) {
  const enabled = scope !== null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["countries", scope, win.from, win.to],
    queryFn: () =>
      apiClient.countries(scope!, win.days, 100, {
        date_from: win.from,
        date_to: win.to,
      }),
    enabled,
    staleTime: 60_000,
  });

  const previous = useQuery({
    queryKey: ["countries", scope, win.prevFrom, win.prevTo],
    queryFn: () =>
      apiClient.countries(scope!, win.days, 100, {
        date_from: win.prevFrom,
        date_to: win.prevTo,
      }),
    enabled: enabled && compare,
    staleTime: 60_000,
  });
  const prevByIso = new Map(
    (previous.data ?? []).map((c) => [c.iso2, c.count] as const),
  );

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
                {compare && previous.data ? (
                  <CountDelta
                    current={c.count}
                    previous={prevByIso.get(c.iso2) ?? 0}
                    title={win.prevLabel}
                  />
                ) : (
                  <span className="w-9 text-right font-mono text-[11px] tabular-nums text-text-tertiary">
                    {pct}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 font-mono text-[11px] text-text-tertiary">
        by mentions, {win.label}
      </div>
    </div>
  );
}

/** Change of a count vs the previous period, by the shared rule (lib/period). */
export function CountDelta({
  current,
  previous,
  title,
  className,
}: {
  current: number;
  previous: number;
  title?: string;
  className?: string;
}) {
  const change = countChange(current, previous)!;
  return (
    <ChangeBadge
      change={change}
      title={title ? `${title}: ${previous.toLocaleString()}` : undefined}
      className={cn("w-14 text-right", className)}
    />
  );
}
