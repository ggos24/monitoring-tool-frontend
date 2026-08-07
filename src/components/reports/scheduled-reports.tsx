"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ConditionChip,
  SegmentFilterBuilder,
} from "@/components/reports/segment-filter-builder";
import type {
  DigestDefinition,
  DigestDefinitionCreate,
  DigestResultDetail,
  SegmentCondition,
} from "@/lib/types";

// "Scheduled reports" — the saved+scheduled twin of the ad-hoc report
// form. Formerly "Digest segments" under Settings; moved here so both
// trigger modes of the same engine live on one tab. Backend unchanged:
// rows are digest_definition, nightly cron writes digest_result.

export function ScheduledReports({
  topicId,
  selectedResultId,
  onSelectResult,
}: {
  topicId: number;
  selectedResultId: number | null;
  onSelectResult: (result: DigestResultDetail, definition: DigestDefinition) => void;
}) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const definitionsQuery = useQuery({
    queryKey: ["digest-definitions", topicId],
    queryFn: () => apiClient.digestDefinitions({ topic_id: topicId }),
    enabled: topicId > 0,
  });
  const definitions = definitionsQuery.data ?? [];

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiClient.updateDigestDefinition(id, { active }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["digest-definitions"] }),
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Update failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteDigestDefinition(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["digest-definitions"] }),
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Delete failed."),
  });

  function handleDelete(def: DigestDefinition) {
    const ok = window.confirm(
      `Delete scheduled report "${def.name}"? Its run history is removed too.`,
    );
    if (!ok) return;
    setError(null);
    deleteMutation.mutate(def.id);
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase text-text-tertiary">
          Scheduled reports
        </h2>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setError(null);
          }}
          className="flex cursor-pointer items-center gap-1 border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-text-tertiary hover:border-strong hover:text-foreground"
        >
          <Plus className="size-3" /> New
        </button>
      </div>

      {error && (
        <div className="mb-2 border border-red-900 bg-red-950/40 px-3 py-2 font-mono text-[11px] text-red-300">
          {error}
        </div>
      )}

      {showCreate && (
        <ScheduledReportCreateForm
          topicId={topicId}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["digest-definitions"] });
          }}
          onError={setError}
        />
      )}

      {definitionsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full bg-elevated" />
          ))}
        </div>
      ) : definitions.length === 0 ? (
        <p className="font-mono text-[11px] text-text-tertiary">
          None yet. A scheduled report runs nightly over its saved filters
          and builds a daily history.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {definitions.map((def) => (
            <ScheduledReportRow
              key={def.id}
              definition={def}
              selectedResultId={selectedResultId}
              onSelectResult={onSelectResult}
              onToggleActive={() =>
                toggleActiveMutation.mutate({
                  id: def.id,
                  active: !def.active,
                })
              }
              onDelete={() => handleDelete(def)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ScheduledReportRow({
  definition,
  selectedResultId,
  onSelectResult,
  onToggleActive,
  onDelete,
}: {
  definition: DigestDefinition;
  selectedResultId: number | null;
  onSelectResult: (result: DigestResultDetail, definition: DigestDefinition) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const resultsQuery = useQuery({
    queryKey: ["digest-results", definition.id],
    queryFn: () => apiClient.digestResults(definition.id, 14),
    enabled: expanded,
  });

  return (
    <li className="border border-border bg-card">
      <div className="flex items-start justify-between gap-2 p-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 cursor-pointer items-start gap-1.5 text-left"
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 size-3 shrink-0 text-text-tertiary" />
          ) : (
            <ChevronRight className="mt-0.5 size-3 shrink-0 text-text-tertiary" />
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0",
                  definition.active ? "bg-emerald-400" : "bg-strong",
                )}
              />
              <span className="truncate text-xs text-foreground">
                {definition.name}
              </span>
            </span>
            <span className="mt-1 flex flex-wrap gap-1">
              <span className="border border-border bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-text-tertiary">
                {definition.report_type === "intelligence_brief"
                  ? "Intelligence brief"
                  : "Executive (legacy)"}
              </span>
              {definition.segment.length === 0 ? (
                <span className="font-mono text-[10px] text-muted-foreground">
                  (no filters)
                </span>
              ) : (
                definition.segment.map((c, i) => (
                  <ConditionChip key={i} condition={c} />
                ))
              )}
            </span>
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleActive}
            className={cn(
              "border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
              definition.active
                ? "border-emerald-900 bg-emerald-950 text-emerald-400 hover:border-emerald-800"
                : "border-border bg-elevated text-text-tertiary hover:border-strong",
            )}
            title={
              definition.active
                ? "Runs nightly — click to pause"
                : "Paused — click to resume"
            }
          >
            {definition.active ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete scheduled report"
            className="cursor-pointer border border-border bg-card p-1 text-text-tertiary hover:border-red-900 hover:text-red-400"
          >
            <Trash2 className="size-3" aria-hidden />
          </button>
        </span>
      </div>

      {expanded && (
        <div className="border-t border-border px-2 py-1.5">
          {resultsQuery.isLoading ? (
            <p className="font-mono text-[10px] text-text-tertiary">
              loading runs…
            </p>
          ) : !resultsQuery.data || resultsQuery.data.length === 0 ? (
            <p className="font-mono text-[10px] text-text-tertiary">
              No runs yet — generates nightly when enough new enriched
              mentions match.
            </p>
          ) : (
            <ul className="flex flex-col">
              {resultsQuery.data.map((res) => (
                <li key={res.id}>
                  <button
                    type="button"
                    onClick={() => onSelectResult(res, definition)}
                    className={cn(
                      "w-full cursor-pointer px-1 py-1 text-left font-mono text-[10px] transition-colors",
                      res.id === selectedResultId
                        ? "bg-elevated text-foreground"
                        : "text-text-secondary hover:bg-elevated/60",
                    )}
                  >
                    {res.period_start.slice(0, 10)} · {res.status ?? "success"} · {res.n_mentions} mentions
                    {res.clusters?.length
                      ? ` · ${res.clusters.length} narratives`
                      : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

// ---------- create form ----------

export function ScheduledReportCreateForm({
  topicId,
  initialFilters,
  onClose,
  onSaved,
  onError,
}: {
  topicId: number;
  initialFilters?: SegmentCondition[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  // An empty saved segment means "all mentions in this topic". Preserve it
  // exactly: the old fallback silently changed a no-filter report to country=DE.
  const [conditions, setConditions] = useState<SegmentCondition[]>(
    initialFilters ?? [],
  );

  const createMutation = useMutation({
    mutationFn: (body: DigestDefinitionCreate) =>
      apiClient.createDigestDefinition(body),
    onSuccess: onSaved,
    onError: (err) =>
      onError(err instanceof ApiError ? err.message : "Create failed."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    const trimmed = name.trim();
    if (!trimmed) {
      onError("Name is required.");
      return;
    }
    createMutation.mutate({
      name: trimmed,
      topic_id: topicId,
      segment: conditions,
      report_type: "intelligence_brief",
      active: true,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 border border-border bg-card p-3"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
          New scheduled report
        </span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer p-1 text-muted-foreground hover:text-text-secondary"
          aria-label="Close"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <label className="mt-3 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
          Name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder='e.g. "Polish coverage"'
          className={cn(
            "mt-1 h-8 w-full border border-border bg-card px-2",
            "font-mono text-[11px] text-foreground placeholder:text-text-tertiary",
            "outline-none transition-colors hover:border-strong focus:border-strong",
          )}
        />
      </label>

      <div className="mt-3">
        <SegmentFilterBuilder
          conditions={conditions}
          onChange={setConditions}
        />
      </div>

      <p className="mt-3 font-mono text-[10px] text-text-tertiary">
        Runs nightly as an intelligence brief. Low-volume days accumulate
        into the next eligible run, and every attempt stays in history.
      </p>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer border border-border bg-card px-3 py-1 font-mono text-[11px] text-text-tertiary hover:border-strong hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className={cn(
            "border px-3 py-1 font-mono text-[11px] transition-colors",
            createMutation.isPending
              ? "cursor-not-allowed border-border bg-card text-text-tertiary"
              : "cursor-pointer border-strong bg-foreground text-primary-foreground hover:bg-text-secondary",
          )}
        >
          {createMutation.isPending ? "Saving…" : "Save schedule"}
        </button>
      </div>
    </form>
  );
}
