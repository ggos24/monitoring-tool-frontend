"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, X } from "lucide-react";

import { apiClient } from "@/lib/api";
import type { SegmentCondition } from "@/lib/types";
import { DEFAULT_REPORT_TYPE } from "@/lib/report-view";
import { countryName, iso2ToFlagEmoji } from "@/lib/country";
import { Button } from "@/components/ui/button";
import type { ScopeSelection } from "@/lib/types";
import { cn } from "@/lib/utils";

// Preset ranges — the same scale as the dashboard PeriodToggle so users
// don't have to learn a second one. `hours` null marks the custom
// branch which reveals the datetime-local pickers below.
const RANGES: { key: RangeKey; label: string; hours: number | null }[] = [
  { key: "7d", label: "7d", hours: 24 * 7 },
  { key: "30d", label: "30d", hours: 24 * 30 },
  { key: "90d", label: "90d", hours: 24 * 90 },
  { key: "custom", label: "Custom", hours: null },
];

type RangeKey = "7d" | "30d" | "90d" | "custom";

function presetKey(days: number | null | undefined): RangeKey | null {
  return RANGES.find((r) => r.hours === (days ?? 0) * 24)?.key ?? null;
}

export function GenerateReportForm({
  scope,
  prefillFilters,
  prefillDateFrom,
  prefillDateTo,
  prefillPresetDays = null,
  onCreated,
  onCancel,
}: {
  scope: ScopeSelection;
  prefillFilters: SegmentCondition[];
  prefillDateFrom: string | null;
  prefillDateTo: string | null;
  /** The Overview's preset (7/30/90 days) when no explicit dates are given. */
  prefillPresetDays?: number | null;
  onCreated: (reportId: number) => void;
  onCancel?: () => void;
}) {
  // Campaign simplification: scope + period + Generate. Filters carried
  // over from the Overview link (country) stay as removable chips; there
  // is no free-form segment builder anymore.
  const [countries, setCountries] = useState<string[]>(() =>
    prefillFilters
      .filter((c) => c.field === "country")
      .flatMap((c) => (Array.isArray(c.value) ? c.value : [c.value]))
      .map((v) => String(v).toUpperCase()),
  );
  // If the user landed here with explicit dates in the URL (from the
  // dashboard's "Generate report" link), default to custom + seed the
  // inputs. Otherwise default to a sensible 7d.
  const initialRange: RangeKey =
    prefillDateFrom || prefillDateTo
      ? "custom"
      : (presetKey(prefillPresetDays) ?? "7d");
  const [range, setRange] = useState<RangeKey>(initialRange);
  const [customFrom, setCustomFrom] = useState(prefillDateFrom ?? "");
  const [customTo, setCustomTo] = useState(prefillDateTo ?? "");
  const [scopeMode, setScopeMode] = useState<"narrative" | "all">(
    scope.kind === "group" ? "all" : "narrative",
  );
  const queryClient = useQueryClient();

  // "All queries" = the `Campaign` topic group (every tracked query,
  // pool excluded). Falls back to the page's own group scope if one is
  // selected; disabled when neither exists.
  const groupsQuery = useQuery({
    queryKey: ["topic-groups"],
    queryFn: apiClient.topicGroups,
  });
  const allGroupId =
    scope.kind === "group"
      ? scope.id
      : (groupsQuery.data?.find((g) => g.name.toLowerCase() === "campaign")
          ?.id ?? null);

  const effectiveFilters: SegmentCondition[] = useMemo(
    () =>
      countries.length > 0
        ? [{ field: "country", op: "in", value: countries }]
        : [],
    [countries],
  );

  // Resolved window — memoized so `new Date()` doesn't churn the preview
  // query key every render (a few minutes' staleness is fine for a count).
  const previewRange = useMemo(
    () => resolveRange({ range, customFrom, customTo }),
    [range, customFrom, customTo],
  );
  const invalidCustomRange =
    range === "custom" &&
    Boolean(previewRange.dateFrom) &&
    Boolean(previewRange.dateTo) &&
    previewRange.dateFrom >= previewRange.dateTo;

  const scopeBody =
    scopeMode === "all" && allGroupId !== null
      ? { group_id: allGroupId }
      : scope.kind === "group"
        ? { group_id: scope.id }
        : { topic_id: scope.id };

  // Live pre-flight scope estimate (no LLM) — refetches as the form changes.
  const preview = useQuery({
    queryKey: [
      "report-preview",
      scopeBody,
      effectiveFilters,
      previewRange.dateFrom,
      previewRange.dateTo,
      DEFAULT_REPORT_TYPE,
    ],
    queryFn: () =>
      apiClient.previewReport({
        ...scopeBody,
        filters: effectiveFilters,
        date_from: previewRange.dateFrom || undefined,
        date_to: previewRange.dateTo || undefined,
        report_type: DEFAULT_REPORT_TYPE,
      }),
    staleTime: 60_000,
    enabled: !invalidCustomRange,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const { dateFrom, dateTo } = resolveRange({ range, customFrom, customTo });
      return apiClient.generateSegmentReport({
        ...scopeBody,
        filters: effectiveFilters,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        report_type: DEFAULT_REPORT_TYPE,
      });
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      onCreated(report.id);
    },
  });

  return (
    <div className="flex flex-col gap-4 border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase text-text-tertiary">
          New report
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="text-text-tertiary hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div>
        <span className="mb-1 block font-mono text-[11px] uppercase text-text-tertiary">
          Scope
        </span>
        <div className="grid grid-cols-2 gap-px bg-border">
          <ScopeButton
            selected={scopeMode === "narrative"}
            disabled={scope.kind === "group"}
            onSelect={() => setScopeMode("narrative")}
            label="This query"
          />
          <ScopeButton
            selected={scopeMode === "all"}
            disabled={allGroupId === null}
            onSelect={() => setScopeMode("all")}
            label="All queries"
            title={
              allGroupId === null
                ? "Needs the “Campaign” group (all queries)"
                : undefined
            }
          />
        </div>
      </div>

      {countries.length > 0 && (
        <div>
          <span className="mb-1 block font-mono text-[11px] uppercase text-text-tertiary">
            Countries
          </span>
          <div className="flex flex-wrap gap-1">
            {countries.map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => setCountries(countries.filter((v) => v !== iso))}
                className="flex items-center gap-1 border border-border bg-muted px-2 py-1 font-mono text-[11px] hover:border-destructive"
                title={`${countryName(iso)} — click to remove`}
              >
                <span>
                  {iso2ToFlagEmoji(iso)} {iso}
                </span>
                <X className="size-3 text-text-tertiary" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className="mb-1 block font-mono text-[11px] uppercase text-text-tertiary">
          Period
        </span>
        <div className="inline-flex flex-wrap items-center gap-0.5 border border-border bg-card p-0.5">
          {RANGES.map((r) => {
            const isActive = r.key === range;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={isActive}
                className={cn(
                  "px-2.5 py-1 font-mono text-[11px] leading-none transition-colors",
                  isActive
                    ? "bg-foreground text-primary-foreground"
                    : "bg-transparent text-text-tertiary hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        {range !== "custom" && (
          <p className="mt-1.5 font-mono text-[10px] text-text-tertiary">
            {describeRange(range)}
          </p>
        )}
        {range === "custom" && (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="report-date-from" className="mb-1 block font-mono text-[10px] uppercase text-text-tertiary">
                From
              </label>
              <input
                id="report-date-from"
                type="datetime-local"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full border border-border bg-background px-2 py-1 font-mono text-xs"
              />
            </div>
            <div>
              <label htmlFor="report-date-to" className="mb-1 block font-mono text-[10px] uppercase text-text-tertiary">
                To
              </label>
              <input
                id="report-date-to"
                type="datetime-local"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full border border-border bg-background px-2 py-1 font-mono text-xs"
              />
            </div>
          </div>
        )}
        {invalidCustomRange && (
          <p className="mt-1.5 font-mono text-[10px] text-destructive">
            End must be later than start.
          </p>
        )}
      </div>

      <PreviewLine
        loading={preview.isFetching}
        error={preview.error as Error | null}
        data={preview.data}
      />

      <div>
        <Button
          type="button"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={
            mutation.isPending ||
            invalidCustomRange ||
            preview.data?.n_mentions === 0
          }
        >
          <Play className="mr-1 size-3" />
          {mutation.isPending ? "Generating…" : "Generate"}
        </Button>
      </div>

      {mutation.error && (
        <p className="font-mono text-xs text-destructive">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  );
}

function ScopeButton({
  selected,
  disabled,
  onSelect,
  label,
  title,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      title={title}
      className={cn(
        "bg-card px-3 py-2 text-left font-mono text-[11px] transition-colors",
        selected ? "bg-elevated text-foreground" : "text-text-tertiary hover:bg-elevated/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {label}
    </button>
  );
}

// ---- live scope preview ----

function PreviewLine({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: Error | null;
  data: { n_mentions: number; n_domains: number; n_relevant: number; will_run_sync: boolean } | undefined;
}) {
  if (error) {
    return (
      <p className="font-mono text-[11px] text-destructive">
        scope preview failed: {error.message}
      </p>
    );
  }
  if (!data) {
    return (
      <p className="font-mono text-[11px] text-text-tertiary">
        {loading ? "estimating scope…" : "…"}
      </p>
    );
  }
  if (data.n_mentions === 0) {
    return (
      <p className="font-mono text-[11px] text-warning">
        No enriched mentions in scope — widen the date range or relax
        filters. ({data.n_relevant} collected, none analyzed yet)
      </p>
    );
  }
  return (
    <p className="font-mono text-[11px] text-text-secondary">
      <span className={cn(loading && "opacity-50")}>
        ≈ <span className="text-foreground">{formatNumber(data.n_mentions)}</span>{" "}
        mentions ·{" "}
        <span className="text-foreground">{formatNumber(data.n_domains)}</span>{" "}
        domains in scope
        {data.n_relevant > data.n_mentions && (
          <span className="text-text-tertiary">
            {" "}
            (of {formatNumber(data.n_relevant)} collected)
          </span>
        )}
        {" · "}
        {data.will_run_sync ? "runs inline" : "runs in background"}
      </span>
    </p>
  );
}

// ---- helpers ----

// Resolved range computed at submit time, not on every render, so the
// `to` boundary stays exactly "now-at-click" rather than drifting with
// React reconciliations. Sent as UTC ISO (Z suffix) — unambiguous; the
// backend treats naive datetimes as UTC, so local-naive strings from
// the datetime-local inputs are converted here, not server-side.
function resolveRange({
  range,
  customFrom,
  customTo,
}: {
  range: RangeKey;
  customFrom: string;
  customTo: string;
}): { dateFrom: string; dateTo: string } {
  if (range === "custom") {
    return {
      dateFrom: localInputToUtcIso(customFrom),
      dateTo: localInputToUtcIso(customTo),
    };
  }
  const preset = RANGES.find((r) => r.key === range);
  if (!preset || preset.hours === null) {
    return { dateFrom: "", dateTo: "" };
  }
  const to = new Date();
  const from = new Date(to.getTime() - preset.hours * 60 * 60 * 1000);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

// "YYYY-MM-DDTHH:MM" (datetime-local, user's local tz) → UTC ISO.
// Date() parses the bare string as local time, so toISOString() is the
// correct conversion. Empty input passes through empty.
function localInputToUtcIso(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function describeRange(range: RangeKey): string {
  const preset = RANGES.find((r) => r.key === range);
  if (!preset || preset.hours === null) return "";
  return `Previous ${preset.label}, ending when generated (UTC)`;
}

function formatNumber(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
