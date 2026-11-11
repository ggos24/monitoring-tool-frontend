"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { formatDayLabel, type DateWindow } from "@/lib/period";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import { theme } from "@/lib/theme";

const TICK_STYLE = {
  fontFamily: "var(--font-geist-mono)",
  fontSize: 10,
  fill: theme.textTertiary,
};

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
  });
  const previous = useQuery({
    queryKey: ["timeline", scope, granularity, country, win.prevFrom, win.prevTo],
    queryFn: () =>
      apiClient.timeline(scope!, win.days, granularity, country, {
        date_from: win.prevFrom,
        date_to: win.prevTo,
      }),
    enabled: enabled && compare,
  });
  const { isLoading, error, refetch } = current;

  // Previous window is aligned by position (day 1 ↔ day 1), so the dashed
  // line reads as "same point last period". Its own date goes in the tooltip.
  const data = current.data?.map((point, i) => {
    const prev = compare ? previous.data?.[i] : undefined;
    return { ...point, prev: prev?.count ?? null, prevDate: prev?.date ?? null };
  });
  const showPrev = compare && !!previous.data;

  const unit = granularity === "hour" ? "Hourly" : "Daily";
  const subtitle =
    `${unit} number of articles` +
    (selectedDay && canDrill
      ? ` · showing ${formatDayLabel(selectedDay)}`
      : canDrill
        ? " · click a day to filter"
        : " (UTC)");

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

  return (
    <div className="bg-card p-5">
      <KickerLabel>Articles over time</KickerLabel>
      <div className="mt-1 mb-4 flex flex-wrap items-baseline justify-between gap-2 text-xs text-text-secondary">
        <span>{subtitle}</span>
        {showPrev && (
          <span className="flex items-center gap-3 font-mono text-[10px] text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-px w-4 bg-success" />
              this period
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block w-4 border-t border-dashed border-text-tertiary" />
              {win.prevLabel}
            </span>
          </span>
        )}
      </div>

      {/* Recharts makes its <svg> surface focusable for keyboard a11y, so a
          click draws the browser focus ring around the whole chart. We convey
          the clicked day with the on-chart line, so suppress that ring. */}
      <div className="h-64 [&_.recharts-surface]:outline-none">
        {!enabled || isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : error ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState message="No data in selected period." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              // Room on both sides so the first/last date labels are never
              // clipped and the y-axis numbers don't touch the first date.
              margin={{ top: 8, right: 20, left: 4, bottom: 0 }}
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
                padding={{ left: 12, right: 12 }}
                tickMargin={6}
                minTickGap={granularity === "hour" ? 24 : 16}
                tickFormatter={(v: string) => formatTick(v, granularity)}
              />
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
                cursor={{ stroke: theme.borderStrong, strokeDasharray: "3 3" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={theme.accentSuccess}
                strokeWidth={1.5}
                fill={theme.accentSuccess}
                fillOpacity={0.18}
                dot={{
                  r: granularity === "hour" ? 2 : 3,
                  fill: theme.accentSuccess,
                  stroke: "none",
                }}
                activeDot={{ r: 5, fill: theme.accentSuccess, stroke: "none" }}
                isAnimationActive={false}
              />
              {showPrev && (
                <Line
                  type="monotone"
                  dataKey="prev"
                  stroke={theme.textTertiary}
                  strokeWidth={1.25}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
              {showSelected && selectedDay && (
                <ReferenceLine
                  x={selectedDay}
                  stroke={theme.accentSuccess}
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                />
              )}
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
        style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10 }}
      >
        {text}
      </text>
    );
  };
}

function formatTick(v: string, granularity: "hour" | "day") {
  if (!v) return "";
  if (granularity === "hour") {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return `${String(d.getUTCHours()).padStart(2, "0")}:00`;
  }
  return v.length >= 10 ? v.slice(5) : v;
}

function formatTooltipLabel(v: string, granularity: "hour" | "day") {
  if (!v) return "";
  if (granularity === "hour") {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    const date = d.toISOString().slice(5, 10);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    return `${date} ${hh}:00 UTC`;
  }
  return v;
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
  return (
    <div className="border border-border bg-overlay px-2.5 py-1.5 font-mono text-[11px] leading-tight">
      <div className="text-text-tertiary">{formatTooltipLabel(label ?? "", granularity)}</div>
      <div className="mt-0.5 text-foreground">
        {point.count} article{point.count === 1 ? "" : "s"}
      </div>
      {showPrev && point.prev !== null && point.prevDate && (
        <div className="mt-0.5 text-text-tertiary">
          {formatTooltipLabel(point.prevDate, granularity)}: {point.prev}
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
