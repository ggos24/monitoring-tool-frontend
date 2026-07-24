"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { formatDayLabel } from "@/lib/period";
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
  days,
  country,
  selectedDay,
  onSelectDay,
}: {
  scope: ScopeParam | null;
  days: number;
  country: string | null;
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
}) {
  const enabled = scope !== null;
  const granularity: "hour" | "day" = days <= 1 ? "hour" : "day";
  const canDrill = granularity === "day";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["timeline", scope, days, granularity, country],
    queryFn: () => apiClient.timeline(scope!, days, granularity, country),
    enabled,
  });

  const subtitle =
    granularity === "hour"
      ? `Hourly mention count, last ${days * 24} hours (UTC)`
      : selectedDay
        ? `Daily mention count, last ${days} days · showing ${formatDayLabel(selectedDay)}`
        : `Daily mention count, last ${days} days · click a day to filter`;

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
      <KickerLabel>Mentions over time</KickerLabel>
      <div className="mt-1 mb-4 text-xs text-text-secondary">{subtitle}</div>

      <div className="h-64">
        {!enabled ? (
          <EmptyState message="Select a topic to load timeline" />
        ) : isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : error ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState message="No data in selected period." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
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
                minTickGap={granularity === "hour" ? 24 : 8}
                tickFormatter={(v: string) => formatTick(v, granularity)}
              />
              <YAxis
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
                width={32}
                allowDecimals={false}
              />
              <Tooltip
                content={<TimelineTooltip granularity={granularity} />}
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
            </AreaChart>
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
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  granularity: "hour" | "day";
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="border border-border bg-overlay px-2.5 py-1.5 font-mono text-[11px] leading-tight">
      <div className="text-text-tertiary">{formatTooltipLabel(label ?? "", granularity)}</div>
      <div className="mt-0.5 text-foreground">
        {payload[0].value} mention{payload[0].value === 1 ? "" : "s"}
      </div>
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
