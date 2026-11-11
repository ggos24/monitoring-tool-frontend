"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { countChange, formatDayLabel, type DateWindow } from "@/lib/period";
import { KickerLabel } from "@/components/ui/kicker-label";
import { AnimatedValue } from "@/components/ui/animated-value";
import { RefreshLine } from "@/components/ui/refresh-line";
import { Skeleton } from "@/components/ui/skeleton";
import { theme } from "@/lib/theme";
import { ChangeBadge } from "./kpi-card";
import {
  comparableTotals,
  excludedLanes,
  excludedLanesText,
  useCampaignHeadlines,
} from "./campaign-data";

const TICK_STYLE = {
  fontFamily: "var(--font-geist-mono)",
  fontSize: 11,
  fill: theme.textTertiary,
};

/**
 * Articles per bucket as bars (counts are discrete — a smoothed curve drew
 * peaks between days that aren't in the data). Header carries the period
 * total, its change and the peak, so the chart reads without hovering.
 * The previous window is a dashed step line, aligned by position.
 *
 * Bars count every source. The header change is like-for-like (campaign
 * headline: only sources that covered the previous window too), the same
 * figure as the KPI card; without that endpoint it falls back to the plain
 * difference of the two totals.
 */
export function TimelineChart({
  scope,
  win,
  compare,
  country,
  selectedDay,
  onSelectDay,
}: {
  scope: ScopeParam | null;
  /** The period window — NOT narrowed by the day drill-down. */
  win: DateWindow;
  /** Overlay the previous equal-length window as a dashed line. */
  compare: boolean;
  country: string | null;
  selectedDay: string | null;
  /** Toggles: the selected day again clears the filter. */
  onSelectDay: (day: string) => void;
}) {
  const enabled = scope !== null;
  const granularity = win.granularity;
  const canDrill = granularity === "day";

  const current = useQuery({
    queryKey: ["timeline", scope, granularity, country, win.from, win.to],
    queryFn: () =>
      apiClient.timeline(scope!, win.days, granularity, country, {
        date_from: win.from,
        date_to: win.to,
      }),
    enabled,
    placeholderData: keepPreviousData,
  });
  const previous = useQuery({
    queryKey: ["timeline", scope, granularity, country, win.prevFrom, win.prevTo],
    queryFn: () =>
      apiClient.timeline(scope!, win.days, granularity, country, {
        date_from: win.prevFrom,
        date_to: win.prevTo,
      }),
    enabled: enabled && compare,
    placeholderData: enabled && compare ? keepPreviousData : undefined,
  });
  const { isLoading, error, refetch } = current;
  const refreshing = current.isPlaceholderData;

  // Previous window is aligned by position (day 1 ↔ day 1), so the dashed
  // line reads as "same point last period". Its own date goes in the tooltip.
  // Memoised: Recharts replays the bar animation whenever `data` is a new
  // array, and a re-render (a day click) must not do that.
  const currentData = current.data;
  const previousData = compare ? previous.data : undefined;
  const data = useMemo(
    () =>
      currentData?.map((point, i) => {
        const prev = previousData?.[i];
        return { ...point, prev: prev?.count ?? null, prevDate: prev?.date ?? null };
      }),
    [currentData, previousData],
  );
  const showPrev = compare && !!previous.data;

  const total = data?.reduce((sum, d) => sum + d.count, 0) ?? 0;
  const prevTotal = showPrev ? previous.data!.reduce((sum, d) => sum + d.count, 0) : undefined;
  // Same queries (and cache) as the KPI grid when no day is drilled into.
  const campaign = useCampaignHeadlines(scope, win, country, compare);
  const cmp = comparableTotals(campaign.current.data);
  const cmpPrev = comparableTotals(campaign.previous.data);
  const likeForLike = compare && campaign.current.data?.all_sources !== undefined;
  const change = !showPrev
    ? undefined
    : likeForLike
      ? cmp && cmpPrev
        ? countChange(cmp.articles, cmpPrev.articles)
        : undefined
      : countChange(total, prevTotal);
  const excluded = likeForLike ? excludedLanes(campaign.current.data) : [];
  const changeTitle =
    `${win.prevLabel}: ${prevTotal}` +
    (excluded.length ? ` · change without ${excludedLanesText(excluded)}` : "");
  const peak = data?.reduce<(typeof data)[number] | null>(
    (best, d) => (d.count > 0 && (!best || d.count > best.count) ? d : best),
    null,
  );

  // Anchor the "no data yet" marker to the earliest day that actually has
  // mentions — NOT the topic-creation date, since collectors backfill
  // articles published before the topic was set up (so data legitimately
  // exists before then). The leading flat-zero run predates any coverage;
  // shade it so it doesn't read as a quiet stretch.
  const firstBucket = data?.[0]?.date;
  const lastBucket = data?.[data.length - 1]?.date;
  const firstDataDate = data?.find((d) => d.count > 0)?.date;
  const showDataMarker =
    canDrill && !!firstBucket && !!firstDataDate && firstDataDate > firstBucket;
  const showSelected =
    canDrill &&
    !!selectedDay &&
    !!firstBucket &&
    !!lastBucket &&
    selectedDay >= firstBucket &&
    selectedDay <= lastBucket;

  const handleChartClick = (state: { activeLabel?: string | number } | null) => {
    if (!canDrill) return;
    const label = state?.activeLabel;
    if (typeof label === "string" && label) onSelectDay(label);
  };

  // Selected day at full strength, the rest dimmed; nothing selected → all even.
  const barOpacity = (date: string) => (showSelected ? (date === selectedDay ? 1 : 0.3) : 1);
  // Share of a day's slot the bar takes; the rest shows the previous period
  // behind it.
  const barShare = granularity === "hour" ? 0.6 : 0.45;

  return (
    <div className="relative bg-card p-5" data-refreshing={refreshing || undefined}>
      <RefreshLine active={refreshing} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <KickerLabel>Articles over time</KickerLabel>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {!enabled || isLoading ? (
              <Skeleton className="h-6 w-32" />
            ) : (
              <>
                <span
                  className="text-[24px] font-medium leading-none text-foreground tabular-nums"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  <AnimatedValue value={total.toLocaleString()} />
                </span>
                <span className="text-xs text-text-secondary">
                  article{total === 1 ? "" : "s"}
                  {granularity === "hour" ? " (UTC)" : ""}
                </span>
                {change && <ChangeBadge change={change} title={changeTitle} />}
                {peak && (
                  <span className="font-mono text-[11px] text-text-tertiary">
                    · peak {formatBucket(peak.date, granularity)} ({peak.count})
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-text-tertiary">
          {showPrev && (
            <>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block size-2.5 bg-text-secondary" />
                This period
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-2.5 w-4 border-t-[1.5px] border-chart-5 bg-overlay" />
                {win.prevLabel}
              </span>
            </>
          )}
          {showSelected && selectedDay ? (
            <span className="text-text-secondary">
              {formatDayLabel(selectedDay)} selected ·{" "}
              <button
                type="button"
                onClick={() => onSelectDay(selectedDay)}
                className="underline decoration-dotted underline-offset-2 hover:text-foreground"
              >
                clear
              </button>
            </span>
          ) : (
            canDrill && <span>Click a day to filter</span>
          )}
        </div>
      </div>

      {/* Recharts makes its <svg> AND its z-index layer <g>s focusable
          (tabindex 0 / -1), so a click on a bar focuses that layer and the
          browser rings its bounding box. The selected day is shown by the
          bar highlight, so suppress the ring on every chart element. */}
      <div className="chart-grow h-64 [&_.recharts-wrapper_*]:outline-none">
        {!enabled || isLoading ? (
          <ChartSkeleton />
        ) : error ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState message="No data in selected period." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
              // Every series gets the whole day slot; the shapes below decide
              // how much of it they paint.
              barCategoryGap={0}
              barGap={0}
              onClick={handleChartClick}
              style={{ cursor: canDrill ? "pointer" : "default" }}
            >
              <CartesianGrid
                horizontal
                vertical={false}
                stroke={theme.borderDefault}
                strokeDasharray="0"
              />
              {showDataMarker && firstBucket && firstDataDate && (
                <ReferenceArea
                  x1={firstBucket}
                  x2={firstDataDate}
                  fill={theme.textMuted}
                  fillOpacity={0.07}
                  stroke="none"
                  ifOverflow="extendDomain"
                />
              )}
              <XAxis
                dataKey="date"
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                tickMargin={6}
                minTickGap={granularity === "hour" ? 24 : 16}
                tickFormatter={(v: string) => formatTick(v, granularity)}
              />
              {/* Same days, hidden: lets the previous-period shade overlap
                  the bars (two bars on one axis sit side by side). */}
              <XAxis xAxisId="prev" dataKey="date" hide />
              <YAxis
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
                width={36}
                tickMargin={6}
                allowDecimals={false}
              />
              <Tooltip
                content={<TimelineTooltip granularity={granularity} showPrev={showPrev} />}
                cursor={{ fill: theme.textPrimary, fillOpacity: 0.04 }}
              />
              {/* Bars grow from the axis via CSS (`.chart-grow`, globals.css),
                  not Recharts' JS animation: a CSS animation ends in the
                  natural state, so the bars are there even when no
                  animation frame ever runs. */}
              {/* Previous period: a quiet silhouette behind the bars, drawn on
                  its own hidden x-axis so it overlaps them instead of sitting
                  beside. A line over the bars got lost against them. */}
              {showPrev && (
                <Bar
                  dataKey="prev"
                  xAxisId="prev"
                  // Explicitly under the bars (300) and the hover band (200):
                  // without it the order follows mount order, and the shade,
                  // which mounts later, would cover the bars.
                  zIndex={150}
                  isAnimationActive={false}
                  shape={(p: BarShape) => <PreviousShade {...p} />}
                />
              )}
              <Bar
                dataKey="count"
                isAnimationActive={false}
                shape={(p: BarShape) => (
                  <CurrentBar {...p} share={barShare} opacity={barOpacity(p.payload?.date ?? "")} />
                )}
              />
              {showDataMarker && firstDataDate && (
                <ReferenceLine
                  x={firstDataDate}
                  stroke={theme.borderStrong}
                  strokeDasharray="3 3"
                  ifOverflow="extendDomain"
                  label={renderMarkerLabel(
                    `data since ${formatDayLabel(firstDataDate)}`,
                  )}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

type BarShape = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { date?: string };
};

function finite(p: BarShape): p is Required<Pick<BarShape, "x" | "y" | "width" | "height">> & BarShape {
  return [p.x, p.y, p.width, p.height].every((v) => typeof v === "number" && Number.isFinite(v));
}

/** One day of the previous period: a full-slot block with a lit top edge. */
function PreviousShade(p: BarShape) {
  if (!finite(p) || p.height <= 0) return null;
  // +0.5px so neighbouring days join without a hairline seam.
  const right = p.x + p.width + 0.5;
  return (
    <g>
      <rect x={p.x} y={p.y} width={right - p.x} height={p.height} fill={theme.bgOverlay} />
      <line x1={p.x} x2={right} y1={p.y} y2={p.y} style={{ stroke: "var(--chart-5)" }} strokeWidth={1.5} />
    </g>
  );
}

/** One day of this period: a bar narrower than its slot, centred. */
function CurrentBar(p: BarShape & { share: number; opacity: number }) {
  if (!finite(p) || p.height <= 0) return null;
  const width = Math.max(2, p.width * p.share);
  return (
    <rect
      x={p.x + (p.width - width) / 2}
      y={p.y}
      width={width}
      height={p.height}
      fill={theme.textSecondary}
      fillOpacity={p.opacity}
    />
  );
}

/** Bars on a baseline — the shape of the chart that is about to appear. */
const SKELETON_BARS = [38, 62, 30, 74, 52, 90, 44, 66, 34, 58, 80, 48];

function ChartSkeleton() {
  return (
    <div className="flex h-full items-end gap-3 border-b border-border px-6 pb-px" aria-hidden>
      {SKELETON_BARS.map((h, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function renderMarkerLabel(text: string, fill: string = theme.textTertiary) {
  return function MarkerLabel(props: {
    viewBox?: { x?: number; y?: number; width?: number; height?: number };
  }) {
    const vb = props?.viewBox;
    if (!vb || vb.x == null || vb.y == null) return null;
    return (
      <text
        x={vb.x + 6}
        y={vb.y + 12}
        fill={fill}
        textAnchor="start"
        style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11 }}
      >
        {text}
      </text>
    );
  };
}

function hourOf(v: string): string | null {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:00`;
}

/** Axis tick: "Nov 4" per day, "14:00" per hour. */
function formatTick(v: string, granularity: "hour" | "day") {
  if (!v) return "";
  if (granularity === "hour") return hourOf(v) ?? v;
  return formatDayLabel(v);
}

/** Header peak: "Nov 7" per day, "Nov 7 14:00" per hour. */
function formatBucket(v: string, granularity: "hour" | "day") {
  if (granularity === "hour") return `${formatDayLabel(v)} ${hourOf(v) ?? ""}`.trim();
  return formatDayLabel(v);
}

/** Tooltip date: "Mon, Nov 10" per day, "Mon, Nov 10 · 14:00 UTC" per hour. */
function formatTooltipLabel(v: string, granularity: "hour" | "day") {
  if (!v) return "";
  const d = new Date(granularity === "hour" ? v : `${v.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return v;
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return granularity === "hour" ? `${date} · ${hourOf(v)} UTC` : date;
}

function TimelineTooltip({
  active,
  payload,
  label,
  granularity,
  showPrev,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { count: number; prev: number | null; prevDate: string | null };
  }>;
  label?: string;
  granularity: "hour" | "day";
  showPrev: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const hasPrev = showPrev && point.prev !== null && !!point.prevDate;
  const diff = hasPrev ? point.count - point.prev! : 0;
  return (
    <div className="border border-border bg-overlay px-2.5 py-1.5 font-mono text-[11px] leading-tight">
      <div className="text-text-tertiary">{formatTooltipLabel(label ?? "", granularity)}</div>
      <div className="mt-0.5 text-foreground">
        {point.count} article{point.count === 1 ? "" : "s"}
        {hasPrev && (
          <span className={diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-text-tertiary"}>
            {" "}
            {diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : "±0"}
          </span>
        )}
      </div>
      {hasPrev && (
        <div className="mt-0.5 text-text-tertiary">
          {formatTooltipLabel(point.prevDate!, granularity)}: {point.prev}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center font-mono text-[11px] text-text-tertiary">
      {message}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center gap-3 font-mono text-[11px] text-text-tertiary">
      <span>Failed to load timeline</span>
      <button
        type="button"
        onClick={onRetry}
        className="border border-border bg-elevated px-2 py-0.5 text-text-secondary hover:border-strong hover:text-foreground"
      >
        retry
      </button>
    </div>
  );
}
