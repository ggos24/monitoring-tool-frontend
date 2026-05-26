"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";

import { apiClient } from "@/lib/api";
import type { SegmentCondition } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Preset ranges — match the dashboard PeriodToggle vocabulary so users
// don't have to learn a second scale. `hours` null marks the custom
// branch which reveals the datetime-local pickers below.
const RANGES: { key: RangeKey; label: string; hours: number | null }[] = [
  { key: "24h", label: "24h", hours: 24 },
  { key: "7d", label: "7d", hours: 24 * 7 },
  { key: "14d", label: "14d", hours: 24 * 14 },
  { key: "30d", label: "30d", hours: 24 * 30 },
  { key: "90d", label: "90d", hours: 24 * 90 },
  { key: "custom", label: "Custom", hours: null },
];

type RangeKey = "24h" | "7d" | "14d" | "30d" | "90d" | "custom";

export function GenerateReportForm({
  topicId,
  prefillFilters,
  prefillDateFrom,
  prefillDateTo,
  onCreated,
}: {
  topicId: number;
  prefillFilters: SegmentCondition[];
  prefillDateFrom: string | null;
  prefillDateTo: string | null;
  onCreated: (reportId: number) => void;
}) {
  const [filters, setFilters] = useState(prefillFilters);
  // If the user landed here with explicit dates in the URL (from the
  // dashboard's "Generate report from current filters" link), default
  // to custom + seed the inputs. Otherwise default to a sensible 7d.
  const initialRange: RangeKey =
    prefillDateFrom || prefillDateTo ? "custom" : "7d";
  const [range, setRange] = useState<RangeKey>(initialRange);
  const [customFrom, setCustomFrom] = useState(prefillDateFrom ?? "");
  const [customTo, setCustomTo] = useState(prefillDateTo ?? "");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const { dateFrom, dateTo } = resolveRange({
        range,
        customFrom,
        customTo,
      });
      return apiClient.generateSegmentReport({
        topic_id: topicId,
        filters,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ["reports", topicId] });
      onCreated(report.id);
    },
  });

  const removeFilter = (idx: number) =>
    setFilters((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-4 border border-border bg-card p-4">
      <h3 className="font-mono text-xs uppercase text-text-tertiary">
        New report
      </h3>

      <div>
        <label className="mb-1 block font-mono text-[11px] uppercase text-text-tertiary">
          Filters
        </label>
        {filters.length === 0 ? (
          <p className="font-mono text-xs italic text-text-tertiary">
            No filters — report covers all enriched mentions in the date range.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {filters.map((c, i) => (
              <button
                key={`${c.field}-${i}`}
                type="button"
                onClick={() => removeFilter(i)}
                className="flex items-center gap-1 border border-border bg-muted px-2 py-1 font-mono text-[11px] hover:border-destructive"
                title="Click to remove"
              >
                <span>
                  {c.field} {c.op} {JSON.stringify(c.value)}
                </span>
                <span className="text-text-tertiary">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block font-mono text-[11px] uppercase text-text-tertiary">
          Date range
        </label>
        <div className="inline-flex flex-wrap items-center gap-0.5 border border-border bg-card p-0.5">
          {RANGES.map((r) => {
            const isActive = r.key === range;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
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
              <label className="mb-1 block font-mono text-[10px] uppercase text-text-tertiary">
                From
              </label>
              <input
                type="datetime-local"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full border border-border bg-background px-2 py-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase text-text-tertiary">
                To
              </label>
              <input
                type="datetime-local"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full border border-border bg-background px-2 py-1 font-mono text-xs"
              />
            </div>
          </div>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="self-start"
      >
        <Play className="mr-1 size-3" />
        {mutation.isPending ? "Generating…" : "Generate"}
      </Button>

      {mutation.error && (
        <p className="font-mono text-xs text-destructive">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  );
}

// ---- helpers ----

// Resolved range computed at submit time, not on every render, so the
// `to` boundary stays exactly "now-at-click" rather than drifting with
// React reconciliations.
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
    return { dateFrom: customFrom, dateTo: customTo };
  }
  const preset = RANGES.find((r) => r.key === range);
  if (!preset || preset.hours === null) {
    return { dateFrom: "", dateTo: "" };
  }
  const to = new Date();
  const from = new Date(to.getTime() - preset.hours * 60 * 60 * 1000);
  return {
    dateFrom: toLocalISOSlice(from),
    dateTo: toLocalISOSlice(to),
  };
}

// "YYYY-MM-DDTHH:MM" — what FastAPI's `datetime | None` Pydantic field
// accepts without a timezone suffix. Local-time interpretation matches
// how the existing dashboard derives its rolling window, so reports
// generated from dashboard filters use the same boundary semantics.
function toLocalISOSlice(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function describeRange(range: RangeKey): string {
  const preset = RANGES.find((r) => r.key === range);
  if (!preset || preset.hours === null) return "";
  const to = new Date();
  const from = new Date(to.getTime() - preset.hours * 60 * 60 * 1000);
  return `${from.toLocaleDateString()} – ${to.toLocaleDateString()}`;
}
