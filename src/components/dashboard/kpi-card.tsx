"use client";

import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Trend } from "@/lib/period";
import { cn } from "@/lib/utils";

export function KpiCard({
  kicker,
  value,
  subtitle,
  trend,
  trendTitle,
  isLoading,
}: {
  kicker: string;
  value: string | number;
  subtitle: string;
  trend?: Trend;
  /** Hover tooltip on the trend badge, e.g. "vs previous 30d". */
  trendTitle?: string;
  isLoading?: boolean;
}) {
  return (
    <div className="bg-card p-5">
      <KickerLabel>{kicker}</KickerLabel>
      <div className="mt-3 flex items-baseline gap-2">
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <span
            className="text-[26px] font-medium leading-none text-foreground tabular-nums"
            style={{ letterSpacing: "-0.02em" }}
          >
            {value}
          </span>
        )}
        {trend && !isLoading && <TrendBadge trend={trend} title={trendTitle} />}
      </div>
      <div className="mt-2 font-mono text-[11px] text-text-tertiary">{subtitle}</div>
    </div>
  );
}

function TrendBadge({ trend, title }: { trend: Trend; title?: string }) {
  if (trend.direction === "stable") {
    return (
      <span className="font-mono text-[11px] text-text-tertiary" title={title}>
        ±0%
      </span>
    );
  }
  if (trend.direction === "new") {
    return (
      <span className="font-mono text-[11px] text-success" title={title}>
        ▲ new
      </span>
    );
  }
  const isUp = trend.direction === "up";
  return (
    <span
      className={cn(
        "font-mono text-[11px] tabular-nums",
        isUp ? "text-success" : "text-danger",
      )}
      title={title}
    >
      {isUp ? "▲" : "▼"} {trend.percentage.toFixed(1)}%
    </span>
  );
}
