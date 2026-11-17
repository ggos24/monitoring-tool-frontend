"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
import {
  activeFilterLabels,
  type SourceFilter,
  type StanceFilter,
} from "@/lib/article-filters";
import { ActiveFilters } from "@/components/dashboard/active-filters";
import type { ScopeParam } from "@/lib/types";
import {
  countChange,
  formatDayLabel,
  formatSpanLabel,
  prevRangeLabel,
  type DateWindow,
  type DaySpan,
} from "@/lib/period";
import { KickerLabel } from "@/components/ui/kicker-label";
import { AnimatedValue } from "@/components/ui/animated-value";
import { RefreshLine } from "@/components/ui/refresh-line";
import { Skeleton } from "@/components/ui/skeleton";
import { theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { ChangeBadge } from "./kpi-card";
import {
  comparableTotals,
  excludedLanes,
  excludedLanesText,
  useCampaignHeadlines,
} from "./campaign-data";

/** Plot-area geometry shared by the chart and the drag overlay. */
const CHART_MARGIN = { top: 8, right: 4, left: 4, bottom: 0 };
const Y_AXIS_WIDTH = 36;
const X_AXIS_HEIGHT = 30; // Recharts' default XAxis height.
/** How close (px) to a band edge a press grabs that edge. */
const EDGE_GRAB = 8;

type Drag = {
  mode: "new" | "left" | "right";
  /** Index the press started on. */
  start: number;
  a: number;
  b: number;
  /** Pointer x at the press; a few px of travel turns a click into a drag. */
  x0: number;
  moved: boolean;
};

const TICK_STYLE = {
  fontFamily: "var(--font-geist-mono)",
  fontSize: 11,
  fill: theme.textTertiary,
};

/**
 * Articles per bucket as bars (counts are discrete — a smoothed curve drew
 * peaks between days that aren't in the data). Header carries the period
 * total, its change and the peak, so the chart reads without hovering.
 * The previous window is a pale bar paired with each day, aligned by position.
 *
 * Bars count every source. The header change is like-for-like (campaign
 * headline: only sources that covered the previous window too), the same
 * figure as the KPI card; without that endpoint it falls back to the plain
 * difference of the two totals.
 *
 * The article-list filters (favorability, collector, outlet) narrow the bars
 * too. The like-for-like figure counts every article, so while one is on the
 * header change is the plain difference of the two filtered totals.
 *
 * Day filter: click a day, or press and drag across several. The band's
 * edges can then be dragged to widen or narrow it; Esc or "clear" drops it.
 * The days are only applied on release, so the other panels refetch once.
 */
export function TimelineChart({
  scope,
  win,
  compare,
  country,
  stance = "all",
  source = "all",
  domain = null,
  selection,
  onSelect,
}: {
  scope: ScopeParam | null;
  /** The period window — NOT narrowed by the day drill-down. */
  win: DateWindow;
  /** Pair each bar with the previous equal-length window. */
  compare: boolean;
  country: string | null;
  stance?: StanceFilter;
  source?: SourceFilter;
  /** Outlet picked in Top media. */
  domain?: string | null;
  /** Days picked on the chart (null = whole period). */
  selection: DaySpan | null;
  /** Click a day (again = clear) or drag a span; null clears. */
  onSelect: (span: DaySpan | null) => void;
}) {
  const enabled = scope !== null;
  const granularity = win.granularity;
  const canDrill = granularity === "day";
  const listFilters = {
    stance_label: stance === "all" ? undefined : stance,
    source: source === "all" ? undefined : source,
    source_domain: domain,
  };
  const filterLabels = activeFilterLabels({ stance, source, domain });
  const listFiltered = filterLabels.length > 0;

  const current = useQuery({
    queryKey: ["timeline", scope, granularity, country, stance, source, domain, win.from, win.to],
    queryFn: () =>
      apiClient.timeline(
        scope!,
        win.days,
        granularity,
        country,
        { date_from: win.from, date_to: win.to },
        listFilters,
      ),
    enabled,
    placeholderData: keepPreviousData,
  });
  const previous = useQuery({
    queryKey: ["timeline", scope, granularity, country, stance, source, domain, win.prevFrom, win.prevTo],
    queryFn: () =>
      apiClient.timeline(
        scope!,
        win.days,
        granularity,
        country,
        { date_from: win.prevFrom, date_to: win.prevTo },
        listFilters,
      ),
    enabled: enabled && compare,
    placeholderData: enabled && compare ? keepPreviousData : undefined,
  });
  const { isLoading, error, refetch } = current;
  const refreshing = current.isPlaceholderData;

  // Previous window is aligned by position (day 1 ↔ day 1), so each pair
  // reads as "same point last period". Its own date goes in the tooltip.
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
  const likeForLike =
    compare && !listFiltered && campaign.current.data?.all_sources !== undefined;
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
  const indexOf = useMemo(
    () => new Map((data ?? []).map((d, i) => [d.date, i] as const)),
    [data],
  );
  const selFrom = selection ? indexOf.get(selection.from) : undefined;
  const selTo = selection ? indexOf.get(selection.to) : undefined;
  const committed: [number, number] | null =
    canDrill && selFrom !== undefined && selTo !== undefined ? [selFrom, selTo] : null;
  const showSelected = committed !== null;

  // Drag state lives here until release; only then do the panels refetch.
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(0);
  const [drag, setDragState] = useState<Drag | null>(null);
  // The handlers read the ref: a quick click fires down and up before React
  // re-renders, and a stale `drag` would leave the band stuck mid-drag.
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const [edgeHover, setEdgeHover] = useState(false);
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHostWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const n = data?.length ?? 0;
  const plotLeft = CHART_MARGIN.left + Y_AXIS_WIDTH;
  const slot = n > 0 ? Math.max(0, hostWidth - plotLeft - CHART_MARGIN.right) / n : 0;
  const active: [number, number] | null = drag
    ? [Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)]
    : committed;

  const pointerX = (e: ReactPointerEvent) =>
    e.clientX - (hostRef.current?.getBoundingClientRect().left ?? 0);
  const indexAt = (x: number) =>
    Math.max(0, Math.min(n - 1, Math.floor((x - plotLeft) / (slot || 1))));
  const edgeAt = (x: number): "left" | "right" | null => {
    if (!committed || slot <= 0) return null;
    if (Math.abs(x - (plotLeft + committed[0] * slot)) <= EDGE_GRAB) return "left";
    if (Math.abs(x - (plotLeft + (committed[1] + 1) * slot)) <= EDGE_GRAB) return "right";
    return null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDrill || n === 0 || e.button !== 0) return;
    const x = pointerX(e);
    if (x < plotLeft) return;
    // No native text selection while dragging across the page.
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    e.currentTarget.setPointerCapture(e.pointerId);
    const i = indexAt(x);
    const edge = edgeAt(x);
    if (edge && committed) {
      setDrag({ mode: edge, start: i, a: committed[0], b: committed[1], x0: x, moved: true });
    } else {
      setDrag({ mode: "new", start: i, a: i, b: i, x0: x, moved: false });
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDrill || n === 0) return;
    const x = pointerX(e);
    const d = dragRef.current;
    if (!d) {
      setEdgeHover(edgeAt(x) !== null);
      return;
    }
    const i = indexAt(x);
    if (d.mode === "left") setDrag({ ...d, a: i });
    else if (d.mode === "right") setDrag({ ...d, b: i });
    else setDrag({ ...d, b: i, moved: d.moved || Math.abs(x - d.x0) > 4 });
  };
  const onPointerUp = () => {
    const drag = dragRef.current;
    if (!drag || !data) return;
    setDrag(null);
    if (drag.mode === "new" && !drag.moved) {
      // A click: one day, or clear when it is the only day picked.
      const day = data[drag.start].date;
      onSelect(selection?.from === day && selection?.to === day ? null : { from: day, to: day });
      return;
    }
    const lo = Math.min(drag.a, drag.b);
    const hi = Math.max(drag.a, drag.b);
    onSelect({ from: data[lo].date, to: data[hi].date });
  };

  // Esc cancels a drag in progress, otherwise clears the picked days —
  // unless the key belongs to a field or an open menu.
  useEffect(() => {
    if (!drag && !selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (dragRef.current) {
        setDrag(null);
        return;
      }
      const el = document.activeElement;
      if (el && el !== document.body && el.closest("input, textarea, select, [role='dialog'], [role='menu'], [role='listbox']")) return;
      onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag, selection, onSelect]);

  const sumOver = (range: [number, number], key: "count" | "prev") => {
    let t = 0;
    for (let i = range[0]; i <= range[1]; i++) t += data?.[i]?.[key] ?? 0;
    return t;
  };
  const activeLabel =
    active && data ? formatSpanLabel({ from: data[active[0]].date, to: data[active[1]].date }) : null;
  const activeCount = active ? sumOver(active, "count") : 0;

  // Picked days at full strength, the rest dimmed; nothing picked → all even.
  const barOpacity = (date: string) => {
    if (!active) return 1;
    const i = indexOf.get(date);
    return i !== undefined && i >= active[0] && i <= active[1] ? 1 : 0.5;
  };
  // Share of a day's slot the bar takes. With the previous period on, the
  // slot holds a pair instead: previous on the left, this period on the right.
  const barShare = granularity === "hour" ? 0.6 : 0.45;
  const pairShare = granularity === "hour" ? 0.8 : 0.7;

  return (
    <div className="relative bg-card p-5" data-refreshing={refreshing || undefined}>
      <RefreshLine active={refreshing} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <KickerLabel>Articles over time</KickerLabel>
          <ActiveFilters labels={filterLabels} className="mt-2" />
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
              <span className="flex items-center gap-1.5" title={win.label}>
                <span aria-hidden className="inline-block size-2.5 bg-text-secondary" />
                This period · <span className="tabular-nums">{total.toLocaleString()}</span>
              </span>
              <span className="flex items-center gap-1.5" title={prevRangeLabel(win)}>
                <span aria-hidden className="inline-block size-2.5 bg-text-secondary opacity-30" />
                {win.prevLabel} ·{" "}
                <span className="tabular-nums">{(prevTotal ?? 0).toLocaleString()}</span>
              </span>
            </>
          )}
          {showSelected && activeLabel && !drag ? (
            <span className="text-text-secondary">
              {activeLabel} · <span className="tabular-nums">{activeCount.toLocaleString()}</span>{" "}
              selected ·{" "}
              <button
                type="button"
                onClick={() => onSelect(null)}
                title="Esc"
                className="underline decoration-dotted underline-offset-2 hover:text-foreground"
              >
                clear
              </button>
            </span>
          ) : (
            canDrill && <span>Click or drag to filter days</span>
          )}
        </div>
      </div>

      {/* Recharts makes its <svg> AND its z-index layer <g>s focusable
          (tabindex 0 / -1), so a click on a bar focuses that layer and the
          browser rings its bounding box. The selected day is shown by the
          bar highlight, so suppress the ring on every chart element. */}
      <div
        ref={hostRef}
        className={cn(
          "chart-grow relative h-64 touch-pan-y select-none [&_.recharts-wrapper_*]:outline-none",
          canDrill && (drag || edgeHover ? "cursor-ew-resize" : "cursor-crosshair"),
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        onPointerLeave={() => setEdgeHover(false)}
      >
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
              margin={CHART_MARGIN}
              // Every series gets the whole day slot; the shapes below decide
              // how much of it they paint.
              barCategoryGap={0}
              barGap={0}
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
              {/* Same days, hidden: both series get the whole day slot, and
                  the shapes below lay them out as a pair. */}
              <XAxis xAxisId="prev" dataKey="date" hide />
              <YAxis
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
                width={Y_AXIS_WIDTH}
                tickMargin={6}
                allowDecimals={false}
              />
              <Tooltip
                // The drag shows its own summary; hide the per-day one meanwhile.
                active={drag ? false : undefined}
                content={<TimelineTooltip granularity={granularity} showPrev={showPrev} />}
                cursor={{ fill: theme.textPrimary, fillOpacity: 0.04 }}
              />
              {/* Bars grow from the axis via CSS (`.chart-grow`, globals.css),
                  not Recharts' JS animation: a CSS animation ends in the
                  natural state, so the bars are there even when no
                  animation frame ever runs. */}
              {/* Previous period: a pale bar paired to the left of each
                  day's bar (same position in the previous window). */}
              {showPrev && (
                <Bar
                  dataKey="prev"
                  xAxisId="prev"
                  isAnimationActive={false}
                  shape={(p: BarShape) => (
                    <PairedBar
                      {...p}
                      share={pairShare}
                      side="left"
                      fillOpacity={0.3 * barOpacity(p.payload?.date ?? "")}
                    />
                  )}
                />
              )}
              <Bar
                dataKey="count"
                isAnimationActive={false}
                shape={(p: BarShape) =>
                  showPrev ? (
                    <PairedBar
                      {...p}
                      share={pairShare}
                      side="right"
                      fillOpacity={barOpacity(p.payload?.date ?? "")}
                    />
                  ) : (
                    <CurrentBar {...p} share={barShare} opacity={barOpacity(p.payload?.date ?? "")} />
                  )
                }
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
        {active && slot > 0 && data && (
          <SelectionBand
            left={plotLeft + active[0] * slot}
            width={(active[1] - active[0] + 1) * slot}
            hostWidth={hostWidth}
            handles={!drag}
            summary={
              drag && activeLabel
                ? {
                    label: activeLabel,
                    count: activeCount,
                    prev: showPrev ? sumOver(active, "prev") : null,
                  }
                : null
            }
          />
        )}
      </div>
    </div>
  );
}

/**
 * The picked days over the plot: a light wash between two edge lines, grab
 * handles once released, and a running summary while dragging. Purely
 * visual — the host div owns the pointer.
 */
function SelectionBand({
  left,
  width,
  hostWidth,
  handles,
  summary,
}: {
  left: number;
  width: number;
  hostWidth: number;
  handles: boolean;
  summary: { label: string; count: number; prev: number | null } | null;
}) {
  const top = CHART_MARGIN.top;
  const bottom = X_AXIS_HEIGHT;
  const diff = summary && summary.prev !== null ? summary.count - summary.prev : null;
  // Summary beside the band's right edge; flips inside when out of room.
  const TIP_W = 168;
  const tipLeft = left + width + 6 + TIP_W > hostWidth ? Math.max(0, left - TIP_W - 6) : left + width + 6;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="absolute border-x border-text-secondary bg-foreground/[0.06]"
        style={{ left, width, top, bottom }}
      />
      {handles &&
        [left, left + width].map((x) => (
          <div
            key={x}
            className="absolute h-7 w-1.5 -translate-x-1/2 -translate-y-1/2 border border-text-secondary bg-overlay"
            style={{ left: x, top: `calc(${top}px + (100% - ${top + bottom}px) / 2)` }}
          />
        ))}
      {summary && (
        <div
          className="absolute border border-border bg-overlay px-2.5 py-1.5 font-mono text-[11px] leading-tight"
          style={{ left: tipLeft, top, width: TIP_W }}
        >
          <div className="text-text-tertiary">{summary.label}</div>
          <div className="mt-0.5 text-foreground">
            {summary.count.toLocaleString()} article{summary.count === 1 ? "" : "s"}
            {diff !== null && (
              <span className={diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-text-tertiary"}>
                {" "}
                {diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : "±0"}
              </span>
            )}
          </div>
          {summary.prev !== null && (
            <div className="mt-0.5 text-text-tertiary">Previous period: {summary.prev}</div>
          )}
        </div>
      )}
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

function finite<T extends BarShape>(p: T): p is T & Required<Pick<BarShape, "x" | "y" | "width" | "height">> {
  return [p.x, p.y, p.width, p.height].every((v) => typeof v === "number" && Number.isFinite(v));
}

/**
 * One half of a day's pair: the previous period on the left, this period on
 * the right, together `share` of the slot with a 2px gap between them.
 */
function PairedBar(
  p: BarShape & { share: number; side: "left" | "right"; fillOpacity: number },
) {
  if (!finite(p) || p.height <= 0) return null;
  const gap = 2;
  const pair = p.width * p.share;
  const width = Math.max(1.5, (pair - gap) / 2);
  const left = p.x + (p.width - pair) / 2;
  return (
    <rect
      x={p.side === "left" ? left : left + width + gap}
      y={p.y}
      width={width}
      height={p.height}
      fill={theme.textSecondary}
      fillOpacity={p.fillOpacity}
    />
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
