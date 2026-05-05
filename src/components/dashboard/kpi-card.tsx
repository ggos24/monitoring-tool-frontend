"use client";

import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Trend =
  | { direction: "up"; percentage: number }
  | { direction: "down"; percentage: number }
  | { direction: "stable" };

export function KpiCard({
  kicker,
  value,
  subtitle,
  trend,
  isLoading,
}: {
  kicker: string;
  value: string | number;
  subtitle: string;
  trend?: Trend;
  isLoading?: boolean;
}) {
  return (
    <div className="bg-zinc-950 p-5">
      <KickerLabel>{kicker}</KickerLabel>
      <div className="mt-3 flex items-baseline gap-2">
        {isLoading ? (
          <Skeleton className="h-8 w-24 bg-zinc-900" />
        ) : (
          <span
            className="text-[26px] font-medium leading-none text-zinc-50 tabular-nums"
            style={{ letterSpacing: "-0.02em" }}
          >
            {value}
          </span>
        )}
        {trend && !isLoading && <TrendBadge trend={trend} />}
      </div>
      <div className="mt-2 font-mono text-[11px] text-zinc-700">{subtitle}</div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend.direction === "stable") {
    return (
      <span className="font-mono text-[11px] text-zinc-600">stable</span>
    );
  }
  const isUp = trend.direction === "up";
  return (
    <span
      className={cn(
        "font-mono text-[11px] tabular-nums",
        isUp ? "text-emerald-400" : "text-red-400",
      )}
    >
      {isUp ? "▲" : "▼"} {trend.percentage.toFixed(1)}%
    </span>
  );
}
