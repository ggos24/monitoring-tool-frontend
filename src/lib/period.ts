/**
 * Period-window helpers for the dashboard KPIs.
 *
 * All dashboard metrics are scoped to the selected period (`days`). To compare
 * against the previous equal-length window we derive two ranges: the current
 * `[from, now]` and the previous `[prevFrom, prevTo]`. `now` is snapped to the
 * top of the current hour so the resulting ISO strings — and therefore the
 * React Query keys built from them — stay stable across renders (they only
 * change once an hour), avoiding a refetch storm on every re-render.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type PeriodRange = {
  /** Start of the current window (ISO, UTC). Pass as `date_from`. */
  from: string;
  /** Start of the previous equal-length window (ISO, UTC). */
  prevFrom: string;
  /** End of the previous window = start of the current one (ISO, UTC). */
  prevTo: string;
};

export function periodRange(days: number): PeriodRange {
  const now = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  const from = new Date(now - days * DAY_MS).toISOString();
  const prevFrom = new Date(now - 2 * days * DAY_MS).toISOString();
  return { from, prevFrom, prevTo: from };
}

export type Trend =
  | { direction: "up"; percentage: number }
  | { direction: "down"; percentage: number }
  | { direction: "stable" }
  | { direction: "new" };

/** Percentage change of `current` vs `previous`, as a KPI trend badge input. */
export function computeTrend(
  current: number | undefined,
  previous: number | undefined,
): Trend | undefined {
  if (current == null || previous == null) return undefined;
  if (previous === 0) return current > 0 ? { direction: "new" } : { direction: "stable" };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) return { direction: "stable" };
  return pct > 0
    ? { direction: "up", percentage: pct }
    : { direction: "down", percentage: Math.abs(pct) };
}
