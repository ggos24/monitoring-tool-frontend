"use client";

import { useMemo } from "react";
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
}: {
  scope: ScopeParam | null;
  days: number;
  country: string | null;
}) {
  const enabled = scope !== null;
  const granularity: "hour" | "day" = days <= 1 ? "hour" : "day";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["timeline", scope, days, granularity, country],
    queryFn: () => apiClient.timeline(scope!, days, granularity, country),
    enabled,
  });

  const subtitle =
    granularity === "hour"
      ? `Hourly mention count, last ${days * 24} hours (UTC)`
      : `Daily mention count, last ${days} days`;

  // Mark when tracking started so a long flat-zero stretch reads as "we
  // weren't collecting yet" rather than "no coverage". Only meaningful on
  // the daily view and only when that date falls inside the window.
  const trackingStart = useTrackingStart(scope);
  const firstBucket = data?.[0]?.date;
  const lastBucket = data?.[data.length - 1]?.date;
  const showTrackingMarker =
    granularity === "day" &&
    !!trackingStart &&
    !!firstBucket &&
    !!lastBucket &&
    trackingStart > firstBucket &&
    trackingStart <= lastBucket;

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
            >
              <CartesianGrid
                horizontal
                vertical={false}
                stroke={theme.borderDefault}
                strokeDasharray="0"
              />
              {showTrackingMarker && firstBucket && trackingStart && (
                <ReferenceArea
                  x1={firstBucket}
                  x2={trackingStart}
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
              {showTrackingMarker && trackingStart && (
                <ReferenceLine
                  x={trackingStart}
                  stroke={theme.borderStrong}
                  strokeDasharray="3 3"
                  ifOverflow="extendDomain"
                  label={renderTrackingLabel(
                    `tracking since ${formatShortDate(trackingStart)}`,
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

// Resolve the scope's tracking-start date (UTC `YYYY-MM-DD`) from the topic
// AST provenance. For a group we take the earliest member start — before
// that day no member was collecting, so the whole span is "not tracked".
// Reuses the cached ["topics"]/["topic-groups"] queries, so no extra fetch.
function useTrackingStart(scope: ScopeParam | null): string | null {
  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: apiClient.topics });
  const isGroup =
    !!scope && typeof scope === "object" && "group_id" in scope;
  const groupsQuery = useQuery({
    queryKey: ["topic-groups"],
    queryFn: apiClient.topicGroups,
    enabled: isGroup,
  });

  return useMemo(() => {
    const topics = topicsQuery.data;
    if (!scope || !topics) return null;

    let topicIds: number[];
    if (typeof scope === "number") topicIds = [scope];
    else if ("group_id" in scope)
      topicIds =
        groupsQuery.data?.find((g) => g.id === scope.group_id)?.topic_ids ?? [];
    else topicIds = [scope.topic_id];

    const starts = topicIds
      .map((id) => topics.find((t) => t.id === id)?.topic_ast?.provenance?.created_at)
      .filter((v): v is string => !!v)
      .map((iso) => new Date(iso).getTime())
      .filter((ms) => !Number.isNaN(ms));

    if (starts.length === 0) return null;
    return new Date(Math.min(...starts)).toISOString().slice(0, 10);
  }, [scope, isGroup, topicsQuery.data, groupsQuery.data]);
}

function formatShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function renderTrackingLabel(text: string) {
  return function TrackingLabel(props: {
    viewBox?: { x?: number; y?: number; width?: number; height?: number };
  }) {
    const vb = props?.viewBox;
    if (!vb || vb.x == null || vb.y == null) return null;
    return (
      <text
        x={vb.x + 6}
        y={vb.y + 12}
        fill={theme.textTertiary}
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
