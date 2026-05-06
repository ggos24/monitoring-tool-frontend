"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiClient } from "@/lib/api";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";

const TICK_STYLE = {
  fontFamily: "var(--font-geist-mono)",
  fontSize: 10,
  fill: "#52525b",
};

export function TimelineChart({
  topicId,
  days,
}: {
  topicId: number | null;
  days: number;
}) {
  const enabled = topicId !== null;
  const granularity: "hour" | "day" = days <= 1 ? "hour" : "day";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["timeline", topicId, days, granularity],
    queryFn: () => apiClient.timeline(topicId!, days, granularity),
    enabled,
  });

  const subtitle =
    granularity === "hour"
      ? `Hourly mention count, last ${days * 24} hours (UTC)`
      : `Daily mention count, last ${days} days`;

  return (
    <div className="bg-zinc-950 p-5">
      <KickerLabel>Mentions over time</KickerLabel>
      <div className="mt-1 mb-4 text-xs text-zinc-400">{subtitle}</div>

      <div className="h-64">
        {!enabled ? (
          <EmptyState message="Select a topic to load timeline" />
        ) : isLoading ? (
          <Skeleton className="h-full w-full bg-zinc-900" />
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
                stroke="#18181b"
                strokeDasharray="0"
              />
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
                cursor={{ stroke: "#27272a", strokeDasharray: "3 3" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#34d399"
                strokeWidth={1.5}
                fill="#34d399"
                fillOpacity={0.08}
                dot={{ r: granularity === "hour" ? 2 : 3, fill: "#34d399", stroke: "none" }}
                activeDot={{ r: 5, fill: "#34d399", stroke: "none" }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
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
    <div className="border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-[11px] leading-tight">
      <div className="text-zinc-500">{formatTooltipLabel(label ?? "", granularity)}</div>
      <div className="mt-0.5 text-zinc-50">
        {payload[0].value} mention{payload[0].value === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center font-mono text-[11px] text-zinc-500">
      {message}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center gap-3 font-mono text-[11px] text-zinc-400">
      <span>Failed to load timeline</span>
      <button
        type="button"
        onClick={onRetry}
        className="border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-300 hover:border-zinc-700 hover:text-zinc-50"
      >
        retry
      </button>
    </div>
  );
}
