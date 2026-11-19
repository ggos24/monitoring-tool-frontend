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
 *
 * With `onClick` the whole card is a toggle button: `action` is the icon in
 * its top-right corner, `active` marks it pressed (a top rule, filled icon).
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
  onClick,
  active,
  action,
  actionLabel,
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
  /** Makes the card a toggle (see above). */
  onClick?: () => void;
  active?: boolean;
  action?: React.ReactNode;
  /** Accessible name of the toggle, e.g. "Show the funnel". */
  actionLabel?: string;
}) {
  const interactive = !!onClick;
  return (
    <div
      className={cn(
        "relative flex flex-col bg-card p-5",
        interactive &&
          "cursor-pointer text-left outline-none transition-colors hover:bg-elevated focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-text-secondary",
        active && "shadow-[inset_0_2px_0_var(--color-foreground)]",
      )}
      title={title}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? !!active : undefined}
      aria-label={interactive ? `${kicker}: ${actionLabel ?? ""}` : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {action && (
        <span
          aria-hidden
          className={cn(
            "absolute right-4 top-4 flex size-6 items-center justify-center border transition-colors",
            active
              ? "border-foreground bg-foreground text-background"
              : "border-border text-text-tertiary",
          )}
        >
          {action}
        </span>
      )}
      <KickerLabel className={action ? "pr-8" : undefined}>{kicker}</KickerLabel>
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
            {isLoading || previous === PREVIOUS_LOADING ? (
              <Skeleton className="inline-block h-3 w-12 align-middle" />
            ) : (
              <span className="text-text-secondary">{previous ?? "—"}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
/** Pass as `previous` while the previous period is still loading: the row
 *  keeps its place and shows a skeleton instead of a value. */
export const PREVIOUS_LOADING = "\u2026";

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
