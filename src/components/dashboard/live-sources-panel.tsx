"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { DateWindow } from "@/lib/period";
import type { ScopeParam } from "@/lib/types";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";

const SOURCES = [
  { key: "gn", label: "Google News" },
  { key: "rss", label: "RSS" },
] as const;

/**
 * Google News + RSS, kept apart from the GKG headline figures (PLAN §9).
 * These collectors only run live — there is no pre-campaign baseline — so
 * the panel never shows Δ or a previous period, whatever the compare switch.
 */
export function LiveSourcesPanel({
  scope,
  win,
  country,
}: {
  scope: ScopeParam | null;
  win: DateWindow;
  country: string | null;
}) {
  return (
    <div className="bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <KickerLabel>Live: Google News &amp; RSS</KickerLabel>
        <span className="font-mono text-[10px] text-text-tertiary">
          live collection only · no before/during comparison
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-px bg-border md:grid-cols-2">
        {SOURCES.map((s) => (
          <SourceColumn key={s.key} source={s.key} label={s.label} scope={scope} win={win} country={country} />
        ))}
      </div>
    </div>
  );
}

function SourceColumn({
  source,
  label,
  scope,
  win,
  country,
}: {
  source: "gn" | "rss";
  label: string;
  scope: ScopeParam | null;
  win: DateWindow;
  country: string | null;
}) {
  const enabled = scope !== null;
  const total = useQuery({
    queryKey: ["mentions-kpi", scope, country, source, win.from, win.to],
    queryFn: () =>
      apiClient.mentions({
        scope: scope!,
        limit: 1,
        source,
        country_iso2: country ?? undefined,
        date_from: win.from,
        date_to: win.to,
      }),
    enabled,
  });
  const outlets = useQuery({
    queryKey: ["sources", scope, country, source, 8, win.from, win.to],
    queryFn: () =>
      apiClient.topSources(scope!, win.days, 8, country, {
        source,
        date_from: win.from,
        date_to: win.to,
      }),
    enabled,
  });

  return (
    <div className="bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">{label}</div>
      {!enabled || total.isLoading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <div className="mt-2 text-[22px] font-medium leading-none tabular-nums text-foreground">
          {(total.data?.total ?? 0).toLocaleString()}
        </div>
      )}
      <div className="mt-1 font-mono text-[11px] text-text-tertiary">articles, {win.label}</div>
      {outlets.data && outlets.data.length > 0 && (
        <ul className="mt-3 space-y-1">
          {outlets.data.map((o) => (
            <li key={o.domain} className="flex justify-between gap-3 font-mono text-[11px]">
              <span className="truncate text-text-secondary">{o.domain}</span>
              <span className="tabular-nums text-foreground">{o.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
