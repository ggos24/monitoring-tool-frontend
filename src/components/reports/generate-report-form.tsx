"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";

import { apiClient } from "@/lib/api";
import type { SegmentCondition } from "@/lib/types";
import { Button } from "@/components/ui/button";

// MVP shape: user inherits filters from the URL (when arriving from
// "Generate report from current filters" on the dashboard) and can
// trim them here. Full freeform editor is deferred — same widgets as
// digest-segments could be reused, but for MVP a chip-list with
// "remove" is sufficient.

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
  const [dateFrom, setDateFrom] = useState(prefillDateFrom ?? "");
  const [dateTo, setDateTo] = useState(prefillDateTo ?? "");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.generateSegmentReport({
        topic_id: topicId,
        filters,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-mono text-[11px] uppercase text-text-tertiary">
            From
          </label>
          <input
            type="datetime-local"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full border border-border bg-background px-2 py-1 font-mono text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[11px] uppercase text-text-tertiary">
            To
          </label>
          <input
            type="datetime-local"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full border border-border bg-background px-2 py-1 font-mono text-xs"
          />
        </div>
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
