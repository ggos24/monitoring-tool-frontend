"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import {
  FAVORABILITY_TOOLTIP,
  favorabilityReadiness,
  insufficientFavorabilityNote,
  type FavorabilityReadiness,
} from "@/lib/favorability";
import { formatPpDelta, type DateWindow } from "@/lib/period";
import type { FavorabilityCounts, FavorabilityStats, ScopeParam } from "@/lib/types";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Scored = Exclude<keyof FavorabilityCounts, "unscored">;

const ROWS: { key: Scored; label: string; bar: string }[] = [
  { key: "favorable", label: "Favorable", bar: "bg-success" },
  { key: "neutral", label: "Neutral", bar: "bg-muted-foreground" },
  { key: "unfavorable", label: "Unfavorable", bar: "bg-danger" },
  { key: "mixed", label: "Mixed", bar: "bg-warning" },
];

/**
 * /api/stats/favorability for one window. Shared query key, so the panel
 * and the "Favorable share" KPI cost one request per window.
 */
export function useFavorability(
  scope: ScopeParam | null,
  from: string,
  to: string,
  country: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["favorability", scope, country, from, to],
    queryFn: () =>
      apiClient.favorability(scope!, {
        date_from: from,
        date_to: to,
        country_iso2: country,
      }),
    enabled: scope !== null && enabled,
  });
}

export function scoredTotal(counts: FavorabilityCounts | undefined): number {
  if (!counts) return 0;
  return counts.favorable + counts.neutral + counts.unfavorable + counts.mixed;
}

/** Readiness of one /stats/favorability response (backend flag or fallback rule). */
export function statsReadiness(data: FavorabilityStats | undefined): FavorabilityReadiness {
  return favorabilityReadiness(data?.counts, data ?? {});
}

/** Favorable ÷ scored, or null when too few articles are scored to say. */
export function favorableShare(data: FavorabilityStats | undefined): number | null {
  const counts = data?.counts;
  const total = scoredTotal(counts);
  return counts && total > 0 && statsReadiness(data).ready ? counts.favorable / total : null;
}

export function FavorabilityPanel({
  scope,
  win,
  compare,
  country,
}: {
  scope: ScopeParam | null;
  win: DateWindow;
  compare: boolean;
  country: string | null;
}) {
  const current = useFavorability(scope, win.from, win.to, country);
  const previous = useFavorability(scope, win.prevFrom, win.prevTo, country, compare);

  const counts = current.data?.counts;
  const readiness = statsReadiness(current.data);
  // Previous-period deltas only when BOTH periods have enough scored articles.
  const prevReady = compare && readiness.ready && statsReadiness(previous.data).ready;
  const prevCounts = prevReady ? previous.data?.counts : undefined;
  const total = scoredTotal(counts);
  const prevTotal = scoredTotal(prevCounts);
  const mean = readiness.ready ? (current.data?.mean_score ?? null) : null;
  const prevMean = prevCounts ? (previous.data?.mean_score ?? null) : null;

  return (
    <div className="flex h-full flex-col bg-card p-5" title={FAVORABILITY_TOOLTIP}>
      <KickerLabel>Favorability</KickerLabel>
      <div className="mt-1 text-xs text-text-secondary">
        How favorable coverage is to Ukraine, {win.label}
      </div>

      {scope === null || current.isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : current.error ? (
        <div className="mt-4 font-mono text-[11px] text-text-tertiary">
          Failed to load favorability.
        </div>
      ) : !counts || total === 0 ? (
        <div className="mt-4 font-mono text-[11px] text-text-tertiary">
          No scored articles in selected period.
          {counts && counts.unscored > 0 && ` ${counts.unscored.toLocaleString()} awaiting analysis.`}
        </div>
      ) : !readiness.ready ? (
        <>
          <div className="mt-4 font-mono text-[11px] text-text-tertiary">
            {insufficientFavorabilityNote(readiness)}
          </div>
          <ul className="mt-4 space-y-2">
            {ROWS.map((r) => (
              <li key={r.key} className="flex items-center gap-2 font-mono text-[11px]">
                <span aria-hidden className={cn("size-2 shrink-0", r.bar)} />
                <span className="flex-1 text-text-secondary">{r.label}</span>
                <span className="tabular-nums text-foreground">{counts[r.key].toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="mt-4 flex items-baseline gap-2">
            <span
              className="text-[26px] font-medium leading-none tabular-nums text-foreground"
              style={{ letterSpacing: "-0.02em" }}
              title="Mean score on a −2 (unfavorable) … +2 (favorable) scale"
            >
              {mean === null ? "—" : formatSigned(mean)}
            </span>
            <span className="font-mono text-[11px] text-text-tertiary">mean, −2…+2</span>
            {mean !== null && prevMean !== null && (
              <span
                className={cn(
                  "font-mono text-[11px] tabular-nums",
                  mean > prevMean ? "text-success" : mean < prevMean ? "text-danger" : "text-text-tertiary",
                )}
                title={`${win.prevLabel}: ${formatSigned(prevMean)}`}
              >
                {mean === prevMean ? "±0" : `${mean > prevMean ? "▲" : "▼"} ${Math.abs(mean - prevMean).toFixed(2)}`}
              </span>
            )}
          </div>

          <div className="mt-4 flex h-2 w-full" role="img" aria-label={ROWS.map((r) => `${r.label} ${pct(counts[r.key], total)}`).join(", ")}>
            {ROWS.map((r) => (
              <div key={r.key} className={r.bar} style={{ width: `${(counts[r.key] / total) * 100}%` }} />
            ))}
          </div>

          <ul className="mt-4 space-y-2">
            {ROWS.map((r) => (
              <li key={r.key} className="flex items-center gap-2 font-mono text-[11px]">
                <span aria-hidden className={cn("size-2 shrink-0", r.bar)} />
                <span className="flex-1 text-text-secondary">{r.label}</span>
                <span className="tabular-nums text-foreground">{counts[r.key].toLocaleString()}</span>
                <span className="w-10 text-right tabular-nums text-text-tertiary">{pct(counts[r.key], total)}</span>
                {prevCounts && (
                  <span
                    className="w-16 text-right tabular-nums text-text-tertiary"
                    title={`${win.prevLabel}: ${prevTotal > 0 ? pct(prevCounts[r.key], prevTotal) : "—"}`}
                  >
                    {prevTotal > 0
                      ? formatPpDelta(counts[r.key] / total, prevCounts[r.key] / prevTotal)
                      : "—"}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-4 font-mono text-[11px] text-text-tertiary">
            {total.toLocaleString()} scored
            {counts.unscored > 0 && ` · ${counts.unscored.toLocaleString()} awaiting analysis`}
          </div>
        </>
      )}
    </div>
  );
}

function pct(n: number, total: number): string {
  return `${Math.round((n / total) * 100)}%`;
}

function formatSigned(v: number): string {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
}
