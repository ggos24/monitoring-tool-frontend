"use client";

import { AnimatedValue } from "@/components/ui/animated-value";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Change } from "@/lib/period";
import { cn } from "@/lib/utils";

/**
 * One headline figure. Every card has the same rows in the same places so a
 * row of cards scans straight across:
 *
 *   kicker
 *   value  change
 *   context            ← always one line (reserved even when empty)
 *   ───────────────
 *   Previous period: x ← pinned to the card bottom, only when comparing
 */
export function KpiCard({
  kicker,
  value,
  context,
  previous,
  previousLabel,
  previousTitle,
  change,
  changeTitle,
  title,
  isLoading,
}: {
  kicker: string;
  /** Hover explanation for the whole card. */
  title?: string;
  value: string | number;
  /** One short fact about the value ("108 of 2,280 articles"). */
  context?: string;
  /** Previous period's value. undefined = not comparing (no row);
   *  null = comparing but no value ("—"). */
  previous?: string | null;
  previousLabel?: string;
  /** vs the previous period — countChange / shareChange from lib/period. */
  change?: Change;
  /** Hover tooltip on the previous-period row, e.g. its dates. */
  previousTitle?: string;
  /** Hover tooltip on the change badge. */
  changeTitle?: string;
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-col bg-card p-5" title={title}>
      <KickerLabel>{kicker}</KickerLabel>
      <div className="mt-3 flex items-baseline gap-2">
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <span
            className="text-[24px] font-medium leading-none text-foreground tabular-nums"
            style={{ letterSpacing: "-0.02em" }}
          >
            <AnimatedValue value={value} />
          </span>
        )}
        {change && !isLoading && <ChangeBadge change={change} title={changeTitle} />}
      </div>
      <div className="mt-2 truncate font-mono text-[11px] text-text-tertiary" title={context}>
        {isLoading ? <Skeleton className="inline-block h-3 w-28 align-middle" /> : context || "\u00a0"}
      </div>
      {previous !== undefined && (
        <div className="mt-auto pt-3">
          <div
            className="truncate border-t border-border pt-2.5 font-mono text-[11px] tabular-nums text-text-tertiary"
            title={previousTitle}
          >
            {previousLabel ?? "Previous period"}:{" "}
            <span className="text-text-secondary">{isLoading ? "…" : (previous ?? "—")}</span>
          </div>
        </div>
      )}
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
