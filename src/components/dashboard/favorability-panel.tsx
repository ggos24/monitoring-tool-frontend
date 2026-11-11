"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import {
  FAVORABILITY_TOOLTIP,
  favorabilityReadiness,
  insufficientFavorabilityNote,
  type FavorabilityReadiness,
} from "@/lib/favorability";
import { formatShare, shareChange, type DateWindow } from "@/lib/period";
import { ChangeBadge } from "./kpi-card";
import type { FavorabilityCounts, FavorabilityStats, ScopeParam, StanceLabel } from "@/lib/types";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Scored = Exclude<keyof FavorabilityCounts, "unscored">;

// Only the two poles carry a saturated colour. Neutral is plain grey and
// Mixed hatched grey — a yellow "mixed" read as a warning and competed
// with the red. Order is fixed: favorable left, unfavorable right.
const HATCH =
  "repeating-linear-gradient(135deg, var(--text-tertiary) 0 2px, transparent 2px 4px)";
const ROWS: { key: Scored; stance: StanceLabel; label: string; bar: string; style?: React.CSSProperties }[] = [
  { key: "favorable", stance: "supportive", label: "Favorable", bar: "bg-success" },
  { key: "neutral", stance: "neutral", label: "Neutral", bar: "bg-text-tertiary" },
  { key: "mixed", stance: "mixed", label: "Mixed", bar: "", style: { backgroundImage: HATCH } },
  { key: "unfavorable", stance: "critical", label: "Unfavorable", bar: "bg-danger" },
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
  selected,
  onSelect,
}: {
  scope: ScopeParam | null;
  win: DateWindow;
  compare: boolean;
  country: string | null;
  /** Tone the article list is filtered by ("all" = none). */
  selected: StanceLabel | "all";
  /** Row click: filter the article list by that tone (again = clear). */
  onSelect: (stance: StanceLabel) => void;
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

  const analysed = counts ? total + counts.unscored : 0;
  const rows = (showShares: boolean) => (
    <ul className="mt-4">
      {ROWS.map((r) => {
        const n = counts![r.key];
        const active = selected === r.stance;
        return (
          <li key={r.key} className="border-t border-border">
            <button
              type="button"
              onClick={() => onSelect(r.stance)}
              aria-pressed={active}
              title={active ? "Clear the article filter" : `Show the ${r.label.toLowerCase()} articles`}
              className={cn(
                "flex w-full items-center gap-2 px-1 py-1.5 text-left font-mono text-[11px] transition-colors hover:bg-elevated",
                active && "bg-elevated",
              )}
            >
              <span aria-hidden className={cn("size-2 shrink-0", r.bar)} style={r.style} />
              <span className={cn("flex-1", active ? "text-foreground" : "text-text-secondary")}>{r.label}</span>
              <span className="tabular-nums text-foreground">{n.toLocaleString()}</span>
              {showShares && (
                <span className="w-10 text-right tabular-nums text-text-tertiary">{pct(n, total)}</span>
              )}
              {showShares && prevCounts && (
                <span
                  className="w-16 text-right tabular-nums text-text-tertiary"
                  title={`${win.prevLabel}: ${prevTotal > 0 ? pct(prevCounts[r.key], prevTotal) : "—"}`}
                >
                  {prevTotal > 0 ? shareChange(n / total, prevCounts[r.key] / prevTotal)!.text : "—"}
                </span>
              )}
              <span aria-hidden className="text-text-tertiary">›</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex h-full flex-col bg-card p-5" title={FAVORABILITY_TOOLTIP}>
      <KickerLabel>Tone toward Ukraine</KickerLabel>

      {scope === null || current.isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : current.error ? (
        <div className="mt-4 text-xs leading-snug text-text-tertiary">
          Failed to load the tone breakdown.
        </div>
      ) : !counts || total === 0 ? (
        <div className="mt-4 text-xs leading-snug text-text-tertiary">
          No analysed articles in the selected period.
          {counts && counts.unscored > 0 && ` ${counts.unscored.toLocaleString()} not analysed.`}
        </div>
      ) : !readiness.ready ? (
        <>
          <div
            className="mt-4 text-xs leading-snug text-text-tertiary"
            title={insufficientFavorabilityNote(readiness)}
          >
            Too few analysed articles for a percentage —{" "}
            {readiness.scored.toLocaleString()} of {readiness.total.toLocaleString()}.
          </div>
          {rows(false)}
        </>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className="text-[24px] font-medium leading-none tabular-nums text-foreground"
              style={{ letterSpacing: "-0.02em" }}
              title={mean === null ? undefined : `Average score ${formatSigned(mean)} on a −2 … +2 scale`}
            >
              {formatShare(counts.favorable / total)}
            </span>
            <span className="font-mono text-[11px] text-text-tertiary">favorable</span>
            {prevCounts && prevTotal > 0 && (
              <ChangeBadge
                change={shareChange(counts.favorable / total, prevCounts.favorable / prevTotal)!}
                title={`${win.prevLabel}: ${pct(prevCounts.favorable, prevTotal)}`}
              />
            )}
          </div>

          {prevCounts && prevTotal > 0 && (
            <div className="mt-4 font-mono text-[11px] text-text-tertiary">This period</div>
          )}
          <ToneBar counts={counts} total={total} className={cn("h-3.5", prevCounts && prevTotal > 0 ? "mt-1" : "mt-4")} />
          {prevCounts && prevTotal > 0 && (
            <>
              <div className="mt-2 font-mono text-[11px] text-text-tertiary">{win.prevLabel}</div>
              <ToneBar counts={prevCounts} total={prevTotal} className="mt-1 h-1.5 opacity-60" />
            </>
          )}

          {rows(true)}

          <div className="mt-auto pt-4 font-mono text-[11px] text-text-tertiary">
            {total.toLocaleString()} of {analysed.toLocaleString()} articles analysed
          </div>
        </>
      )}
    </div>
  );
}

/** Stacked shares. Gaps between segments and a minimum width, so a
 *  category with one or two articles is still visible. */
function ToneBar({
  counts,
  total,
  className,
}: {
  counts: FavorabilityCounts;
  total: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex w-full gap-0.5", className)}
      role="img"
      aria-label={ROWS.map((r) => `${r.label} ${pct(counts[r.key], total)}`).join(", ")}
    >
      {ROWS.filter((r) => counts[r.key] > 0).map((r) => (
        <div
          key={r.key}
          className={cn("min-w-1.5", r.bar)}
          style={{ ...r.style, flexGrow: counts[r.key], flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

function pct(n: number, total: number): string {
  return `${Math.round((n / total) * 100)}%`;
}

function formatSigned(v: number): string {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
}
