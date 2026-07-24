"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { effectiveRanges, formatDayLabel } from "@/lib/period";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";

// Replaces the old "LLM sentiment (Phase 2)" placeholder with a metric we
// can show *today*: how coverage splits across outlet-quality tiers. The
// bands are deterministic (domain scoring — no LLM), so this is live and
// exact, and it's what a disinfo-monitoring desk cares about most —
// trusted media vs. low-quality vs. flagged-propaganda share of voice.
const BANDS = [
  { key: "trusted", label: "Trusted", bar: "bg-success", text: "text-success" },
  { key: "suspect", label: "Suspect", bar: "bg-warning", text: "text-warning" },
  {
    key: "propaganda",
    label: "Propaganda",
    bar: "bg-danger",
    text: "text-danger",
  },
] as const;

export function SourceQualityBreakdown({
  scope,
  days,
  country,
  selectedDay,
}: {
  scope: ScopeParam | null;
  days: number;
  country: string | null;
  selectedDay: string | null;
}) {
  const enabled = scope !== null;
  const { curFrom, curTo } = effectiveRanges(days, selectedDay);

  const { data, isLoading, error } = useQuery({
    queryKey: ["source-quality", scope, country, curFrom, curTo],
    enabled,
    queryFn: async () => {
      const [trusted, suspect, propaganda] = await Promise.all(
        BANDS.map((b) =>
          apiClient
            .mentions({
              scope: scope!,
              limit: 1,
              score_band: b.key,
              country_iso2: country ?? undefined,
              date_from: curFrom,
              date_to: curTo,
            })
            .then((r) => r.total),
        ),
      );
      return {
        trusted,
        suspect,
        propaganda,
        total: trusted + suspect + propaganda,
      };
    },
  });

  const total = data?.total ?? 0;

  return (
    <div className="bg-card p-5">
      <KickerLabel>Source quality</KickerLabel>
      <div className="mt-1 mb-4 text-sm text-text-secondary">
        Share of coverage by outlet tier,{" "}
        {selectedDay ? formatDayLabel(selectedDay) : `last ${days}d`}
      </div>

      {!enabled || isLoading ? (
        <div className="space-y-4">
          {BANDS.map((b) => (
            <div key={b.key}>
              <Skeleton className="mb-1.5 h-3 w-full" />
              <Skeleton className="h-1 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <Empty message="Failed to load source quality." />
      ) : total === 0 ? (
        <Empty message="No mentions in selected period." />
      ) : (
        <>
          <div className="space-y-4">
            {BANDS.map((b) => {
              const count = data![b.key];
              const pct = (count / total) * 100;
              return (
                <div key={b.key}>
                  <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
                    <span className={b.text}>{b.label}</span>
                    <span className="tabular-nums text-text-tertiary">
                      {count.toLocaleString()} · {formatPct(pct)}
                    </span>
                  </div>
                  <div className="h-1 bg-strong">
                    <div
                      className={`h-full ${b.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 font-mono text-[10px] text-text-tertiary">
            {total.toLocaleString()} scored mentions · domain scoring
          </div>
        </>
      )}
    </div>
  );
}

function formatPct(pct: number): string {
  if (pct > 0 && pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center font-mono text-[11px] text-text-tertiary">
      {message}
    </div>
  );
}
