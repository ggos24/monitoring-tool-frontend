import type { SourceFilter } from "@/components/dashboard/mentions-list";
import type { ScopeSelection } from "./types";
import { resolveWindow, type Period } from "./period";

/**
 * The operator's last-picked query + filters, kept in localStorage so the
 * choice survives reloads and the Overview ↔ Reports round trip until the
 * operator changes it. Per-browser convenience only: every read and write
 * is best-effort (private windows, blocked storage → defaults).
 */
export type StoredFilters = {
  scope: ScopeSelection | null;
  period: Period;
  country: string | null;
  source: SourceFilter;
  compare: boolean;
};

const KEY = "u24.dashboard-filters.v1";

/** Presets the period toggle offers. Older stored values (24h) fall back. */
export const PERIOD_PRESET_DAYS = [7, 30, 90] as const;

export const DEFAULT_PERIOD: Period = { kind: "preset", days: 7 };

const SOURCES: readonly SourceFilter[] = ["all", "gn", "gdelt", "firehose", "rss"];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function loadFilters(): Partial<StoredFilters> {
  let raw: unknown;
  try {
    raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
  } catch {
    return {};
  }
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<StoredFilters> = {};
  const scope = parseScope(r.scope);
  if (scope) out.scope = scope;
  const period = parsePeriod(r.period);
  if (period) out.period = period;
  if (typeof r.country === "string" && /^[A-Z]{2}$/.test(r.country)) out.country = r.country;
  if (typeof r.source === "string" && SOURCES.includes(r.source as SourceFilter)) {
    out.source = r.source as SourceFilter;
  }
  if (typeof r.compare === "boolean") out.compare = r.compare;
  return out;
}

export function saveFilters(patch: Partial<StoredFilters>): void {
  try {
    const current = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") ?? {};
    window.localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Storage unavailable — the filters just won't persist.
  }
}

function parseScope(v: unknown): ScopeSelection | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if ((s.kind === "topic" || s.kind === "group") && Number.isInteger(s.id) && (s.id as number) > 0) {
    return { kind: s.kind, id: s.id as number };
  }
  return null;
}

function parsePeriod(v: unknown): Period | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  if (p.kind === "preset" && PERIOD_PRESET_DAYS.includes(p.days as 7)) {
    return { kind: "preset", days: p.days as number };
  }
  if (
    p.kind === "range" &&
    typeof p.from === "string" &&
    typeof p.to === "string" &&
    ISO_DAY.test(p.from) &&
    ISO_DAY.test(p.to) &&
    p.from <= p.to
  ) {
    return { kind: "range", from: p.from, to: p.to };
  }
  return null;
}

/** `YYYY-MM-DDTHH:mm` in the browser's zone (the report form's inputs). */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A dashboard period as the report form's local datetime bounds. */
export function periodToLocalRange(period: Period): { from: string; to: string } {
  const win = resolveWindow(period, null);
  return { from: toLocalInput(new Date(win.from)), to: toLocalInput(new Date(win.to)) };
}
