"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import type { PromptTemplateOut } from "@/lib/types";

// Operator-visible LLM prompts (GET /api/settings/prompts). The two
// report prompts (per-narrative MAP + final REDUCE) are editable —
// changes apply to the NEXT report run, no redeploy. The nightly
// enrichment stance prompt is shown read-only: a bad edit there would
// silently corrupt a whole night of stance verdicts.

export function PromptsEditor() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["prompts"],
    queryFn: apiClient.prompts,
  });

  return (
    <section className="bg-card p-5">
      <KickerLabel>Report prompts</KickerLabel>
      <p className="mt-1 text-xs text-text-tertiary">
        The exact instructions the LLM receives at each report step. Edits
        apply to the next report run — the JSON output schema and the data
        payload are fixed in code.
      </p>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-24 w-full bg-elevated" />
          <Skeleton className="h-24 w-full bg-elevated" />
        </div>
      ) : error ? (
        <div className="mt-4 font-mono text-[11px] text-text-tertiary">
          Failed to load prompts.{" "}
          <button
            type="button"
            onClick={() => refetch()}
            className="cursor-pointer text-foreground underline-offset-2 hover:underline"
          >
            retry
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {(data ?? []).map((p) =>
            p.editable ? (
              <EditablePrompt key={p.key} prompt={p} />
            ) : (
              <ReadOnlyPrompt key={p.key} prompt={p} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function EditablePrompt({ prompt }: { prompt: PromptTemplateOut }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const text = draft ?? prompt.text;
  const dirty = draft !== null && draft !== prompt.text;

  const saveMutation = useMutation({
    mutationFn: () => apiClient.updatePrompt(prompt.key, text),
    onSuccess: () => {
      setDraft(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Save failed."),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiClient.resetPrompt(prompt.key),
    onSuccess: () => {
      setDraft(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Reset failed."),
  });

  return (
    <div className="border border-border bg-card">
      <PromptHeader
        prompt={prompt}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      {expanded && (
        <div className="border-t border-border p-3">
          <textarea
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(18, Math.max(8, text.split("\n").length + 2))}
            spellCheck={false}
            className={cn(
              "w-full resize-y border border-border bg-background p-2",
              "font-mono text-[11px] leading-relaxed text-foreground",
              "outline-none transition-colors hover:border-strong focus:border-strong",
            )}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-text-tertiary">
              {prompt.is_overridden
                ? `overridden${prompt.updated_at ? ` · ${new Date(prompt.updated_at).toLocaleString()}` : ""}`
                : "using code default"}
              {" · model: "}
              {prompt.model_setting ?? "—"}
            </span>
            <span className="flex items-center gap-2">
              {prompt.is_overridden && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Reset this prompt to the code default? The current override is discarded.",
                      )
                    ) {
                      resetMutation.mutate();
                    }
                  }}
                  disabled={resetMutation.isPending}
                  className="flex cursor-pointer items-center gap-1 border border-border bg-card px-2 py-1 font-mono text-[10px] text-text-tertiary hover:border-strong hover:text-foreground"
                >
                  <RotateCcw className="size-3" /> Reset to default
                </button>
              )}
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={!dirty || saveMutation.isPending}
                className={cn(
                  "border px-3 py-1 font-mono text-[10px] transition-colors",
                  !dirty || saveMutation.isPending
                    ? "cursor-not-allowed border-border bg-card text-text-tertiary"
                    : "cursor-pointer border-strong bg-foreground text-primary-foreground hover:bg-text-secondary",
                )}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </span>
          </div>
          {error && (
            <p className="mt-2 font-mono text-[11px] text-red-300">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ReadOnlyPrompt({ prompt }: { prompt: PromptTemplateOut }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border bg-card">
      <PromptHeader
        prompt={prompt}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        badge="read-only"
      />
      {expanded && (
        <div className="border-t border-border p-3">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words bg-background p-2 font-mono text-[10px] leading-relaxed text-text-secondary">
            {prompt.text}
          </pre>
          <p className="mt-2 font-mono text-[10px] text-text-tertiary">
            Locked: this prompt runs inside the nightly batch — a bad edit
            would silently corrupt a full night of stance data.
          </p>
        </div>
      )}
    </div>
  );
}

function PromptHeader({
  prompt,
  expanded,
  onToggle,
  badge,
}: {
  prompt: PromptTemplateOut;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full cursor-pointer items-center justify-between gap-2 p-3 text-left"
    >
      <span className="flex min-w-0 items-center gap-2">
        {expanded ? (
          <ChevronDown className="size-3 shrink-0 text-text-tertiary" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-text-tertiary" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-xs text-foreground">
            {prompt.title}
          </span>
          <span className="block truncate font-mono text-[10px] text-text-tertiary">
            {prompt.description}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {prompt.is_overridden && (
          <span className="border border-amber-900 bg-amber-950/50 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
            overridden
          </span>
        )}
        {badge && (
          <span className="border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}
