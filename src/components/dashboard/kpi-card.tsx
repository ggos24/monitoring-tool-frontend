"use client";

import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Change } from "@/lib/period";
import { cn } from "@/lib/utils";

export function KpiCard({
  kicker,
  value,
  subtitle,
  change,
  changeTitle,
  title,
  isLoading,
}: {
  kicker: string;
  /** Hover explanation for the whole card. */
  title?: string;
  value: string | number;
  subtitle: React.ReactNode;
  /** vs the previous period — countChange / shareChange from lib/period. */
  change?: Change;
  /** Hover tooltip on the change badge. */
  changeTitle?: string;
  isLoading?: boolean;
}) {
  return (
    <div className="bg-card p-5" title={title}>
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
        {change && !isLoading && <ChangeBadge change={change} title={changeTitle} />}
      </div>
      <div className="mt-2 font-mono text-[11px] text-text-tertiary">{subtitle}</div>
    </div>
  );
}

/** The one rendering of a "vs previous period" change (see lib/period). */
export function ChangeBadge({
  change,
  title,
  className,
}: {
  change: Change;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "font-mono text-[11px] tabular-nums whitespace-nowrap",
        change.direction === "up" || change.direction === "new"
          ? "text-success"
          : change.direction === "down"
            ? "text-danger"
            : "text-text-tertiary",
        className,
      )}
    >
      {change.text}
    </span>
  );
}
