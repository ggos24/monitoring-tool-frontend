"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { activeFilterLabels, type SourceFilter } from "@/lib/article-filters";
import { ActiveFilters } from "@/components/dashboard/active-filters";
import {
  FAVORABILITY_TOOLTIP,
  favorabilityReadiness,
  insufficientFavorabilityNote,
  type FavorabilityReadiness,
} from "@/lib/favorability";
import { formatShare, shareChange, type DateWindow } from "@/lib/period";
import { ChangeBadge } from "./kpi-card";
import type { FavorabilityCounts, FavorabilityStats, ScopeParam, StanceLabel } from "@/lib/types";
import { AnimatedValue } from "@/components/ui/animated-value";
import { KickerLabel } from "@/components/ui/kicker-label";
import { RefreshLine } from "@/components/ui/refresh-line";
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
  // Article-list filters (collector, outlet); the KPI grid passes none.
  filters: { source?: SourceFilter; domain?: string | null } = {},
) {
  const source = filters.source && filters.source !== "all" ? filters.source : undefined;
  const domain = filters.domain ?? null;
  return useQuery({
    queryKey: ["favorability", scope, country, source ?? "all", domain, from, to],
    queryFn: () =>
      apiClient.favorability(scope!, {
        date_from: from,
        date_to: to,
        country_iso2: country,
        source,
        source_domain: domain,
      }),
    enabled: scope !== null && enabled,
    placeholderData: enabled ? keepPreviousData : undefined,
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
  source = "all",
  domain = null,
  selected,
  onSelect,
  dayLabel = null,
}: {
  scope: ScopeParam | null;
  win: DateWindow;
  compare: boolean;
  country: string | null;
  /** Collector filter of the article list. */
  source?: SourceFilter;
  /** Outlet picked in Top media. */
  domain?: string | null;
  /** Tone the article list is filtered by ("all" = none). */
  selected: StanceLabel | "all";
  /** Row click: filter the article list by that tone (again = clear). */
  onSelect: (stance: StanceLabel) => void;
  /** Days picked on the chart ("Oct 31", "Nov 7 – Nov 12"); the panel covers only them. */
  dayLabel?: string | null;
}) {
  // The tone filter itself is NOT applied: this panel is the breakdown it
  // picks from, so its selected row is highlighted instead.
  const current = useFavorability(scope, win.from, win.to, country, true, { source, domain });
  const previous = useFavorability(scope, win.prevFrom, win.prevTo, country, compare, {
    source,
    domain,
  });

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
                "group flex w-full items-center gap-2 px-1 py-1.5 text-left font-mono text-[11px] transition-colors hover:bg-elevated",
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
                  {/* The previous share itself, not a delta: on a 1% share a
                      relative change ("+400%") says nothing. */}
                  {prevTotal > 0 ? `was ${pct(prevCounts[r.key], prevTotal)}` : "—"}
                </span>
              )}
              <span aria-hidden className="text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-foreground">›</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className="relative flex h-full flex-col bg-card p-5"
      title={FAVORABILITY_TOOLTIP}
      data-refreshing={current.isPlaceholderData || undefined}
    >
      <RefreshLine active={current.isPlaceholderData} />
      <KickerLabel>
        Good or bad for Ukraine
        {dayLabel && <span className="text-text-secondary"> · {dayLabel}</span>}
      </KickerLabel>
      <ActiveFilters labels={activeFilterLabels({ source, domain })} className="mt-2" />

      {scope === null || current.isLoading ? (
        // Same shape as the loaded panel: figure, bar, four rows.
        <div aria-hidden>
          <Skeleton className="mt-3 h-6 w-28" />
          <Skeleton className="mt-4 h-3.5 w-full" />
          <div className="mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 border-t border-border px-1 py-1.5">
                <Skeleton className="size-2" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="ml-auto h-3 w-16" />
              </div>
            ))}
          </div>
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
              <AnimatedValue value={formatShare(counts.favorable / total)} />
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

          <CoverageBlock coverage={current.data?.coverage} />

          <div className="mt-auto pt-4 font-mono text-[11px] text-text-tertiary">
            {total.toLocaleString()} of {analysed.toLocaleString()} articles analysed
          </div>
        </>
      )}
    </div>
  );
}

/** The second indicator: whose side the presentation takes, whatever
 *  happened (backend `coverage_label`). Not a filter — read-only. */
function CoverageBlock({ coverage }: { coverage: FavorabilityStats["coverage"] }) {
  if (!coverage || coverage.n === 0) return null;
  const counts: FavorabilityCounts = { ...coverage, unscored: 0 };
  return (
    <div className="mt-5 border-t border-border pt-4">
      <div
        className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary"
        title="A separate answer from the score above: does the article present the matter in Ukraine's favour (Russia responsible, Ukraine's need, rebuts Kremlin claims) or against it — whatever actually happened."
      >
        How articles present it
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[18px] font-medium leading-none tabular-nums text-foreground">
          {pct(coverage.favorable, coverage.n)}
        </span>
        <span className="font-mono text-[11px] text-text-tertiary">favorable presentation</span>
      </div>
      <ToneBar counts={counts} total={coverage.n} className="mt-3 h-2" />
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px]">
        {ROWS.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <span aria-hidden className={cn("size-2 shrink-0", r.bar)} style={r.style} />
            <span className="flex-1 text-text-secondary">{r.label}</span>
            <span className="tabular-nums text-foreground">{coverage[r.key].toLocaleString()}</span>
            <span className="w-8 text-right tabular-nums text-text-tertiary">{pct(coverage[r.key], coverage.n)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 font-mono text-[11px] text-text-tertiary">
        {coverage.n.toLocaleString()} articles with this answer
      </div>
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
          className={cn("min-w-1.5 transition-[flex-grow] duration-[var(--dur-slow)]", r.bar)}
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
