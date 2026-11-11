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

/** Inclusive UTC [from, to] bounds for a single `YYYY-MM-DD` day. */
export function dayRange(day: string): { from: string; to: string } {
  return { from: `${day}T00:00:00.000Z`, to: `${day}T23:59:59.999Z` };
}

/** Compact UTC day label, e.g. "Jul 16". Accepts `YYYY-MM-DD` or ISO. */
export function formatDayLabel(day: string): string {
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** What the operator picked: a rolling preset or an explicit UTC date range. */
export type Period =
  | { kind: "preset"; days: number }
  /** Inclusive UTC calendar days, `YYYY-MM-DD`. */
  | { kind: "range"; from: string; to: string };

/**
 * The resolved window every panel queries, plus the previous equal-length
 * window for Δ and the dashed timeline overlay. All bounds are ISO strings
 * (inclusive on the backend), stable for an hour in preset mode so they can
 * sit in React Query keys.
 */
export type DateWindow = {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  /** Window length in days (≥ 1, fractional never). */
  days: number;
  granularity: "hour" | "day";
  /** Short human label: "last 7d", "Nov 1 – Nov 30", "Nov 3". */
  label: string;
  /** Label for the previous window — always "Previous period". */
  prevLabel: string;
};

export const PREVIOUS_PERIOD = "Previous period";

export function resolveWindow(period: Period, day: string | null): DateWindow {
  if (day) {
    const { from, to } = dayRange(day);
    return withPrevious(from, to, 1, "day", formatDayLabel(day));
  }
  if (period.kind === "preset") {
    const now = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    const from = new Date(now - period.days * DAY_MS).toISOString();
    const to = new Date(now).toISOString();
    return withPrevious(
      from,
      to,
      period.days,
      period.days <= 1 ? "hour" : "day",
      `last ${period.days}d`,
    );
  }
  const from = dayRange(period.from).from;
  const to = dayRange(period.to).to;
  const days = Math.max(1, Math.round((new Date(to).getTime() + 1 - new Date(from).getTime()) / DAY_MS));
  const label =
    period.from === period.to
      ? formatDayLabel(period.from)
      : `${formatDayLabel(period.from)} – ${formatDayLabel(period.to)}`;
  return withPrevious(
    from,
    to,
    days,
    days <= 1 ? "hour" : "day",
    label,
  );
}

function withPrevious(
  from: string,
  to: string,
  days: number,
  granularity: "hour" | "day",
  label: string,
): DateWindow {
  const fromMs = new Date(from).getTime();
  const span = new Date(to).getTime() - fromMs;
  // Backend bounds are inclusive on both ends: stop 1ms short of `from` so
  // a mention at exactly the boundary is never counted in both windows.
  const prevTo = new Date(fromMs - 1).toISOString();
  const prevFrom = new Date(fromMs - 1 - span).toISOString();
  return { from, to, prevFrom, prevTo, days, granularity, label, prevLabel: PREVIOUS_PERIOD };
}

/** Today's UTC calendar day, `YYYY-MM-DD`. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One rule for every "vs previous period" figure on the dashboard (KPI
 * cards, sources, countries, favorability):
 *  - counts  → relative change, whole percent: "+25%", "−37%";
 *              previous 0 → "new" (or "—" when both are 0);
 *              previous under SMALL_BASE → the plain difference, "+45":
 *              1 → 46 is "+4500%", a number that says nothing;
 *  - shares  → the same relative change of the figure on screen:
 *              5.8% → 3.9% is "−33%". One unit for every badge; the
 *              previous value sits right under it. (The difference of the
 *              two percentages, "−1.9", is percentage points — a second
 *              unit next to plain percents confused readers.)
 * The sign carries the direction; colour repeats it, never "good" or "bad".
 */
export type Change = {
  text: string;
  direction: "up" | "down" | "flat" | "new" | "none";
};

const MINUS = "\u2212";

/** Below this previous count a percentage is noise — show the difference. */
export const SMALL_BASE = 10;

function signed(n: number, digits: number, unit = "%"): string {
  const abs = Math.abs(n).toFixed(digits);
  return `${n > 0 ? "+" : MINUS}${abs}${unit}`;
}

export function countChange(
  current: number | undefined | null,
  previous: number | undefined | null,
): Change | undefined {
  if (current == null || previous == null) return undefined;
  if (previous === 0) {
    return current > 0 ? { text: "new", direction: "new" } : { text: "—", direction: "none" };
  }
  if (previous < SMALL_BASE) {
    const diff = current - previous;
    if (diff === 0) return { text: "±0", direction: "flat" };
    return { text: signed(diff, 0, ""), direction: diff > 0 ? "up" : "down" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: "±0%", direction: "flat" };
  return { text: signed(pct, 0), direction: pct > 0 ? "up" : "down" };
}

/** Change of a share (0–1): relative, like a count — 5.8% → 3.9% = "−33%". */
export function shareChange(
  current: number | undefined | null,
  previous: number | undefined | null,
): Change | undefined {
  if (current == null || previous == null) return undefined;
  if (previous === 0) {
    return current > 0 ? { text: "new", direction: "new" } : { text: "—", direction: "none" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: "±0%", direction: "flat" };
  return { text: signed(pct, 0), direction: pct > 0 ? "up" : "down" };
}

/** The previous window's dates, for a hover: "Oct 28 – Nov 3". */
export function prevRangeLabel(win: DateWindow): string {
  const a = formatDayLabel(win.prevFrom.slice(0, 10));
  const b = formatDayLabel(win.prevTo.slice(0, 10));
  return a === b ? a : `${a} – ${b}`;
}

/** Share (0–1) as a percentage label, "4.9%". */
export function formatShare(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
