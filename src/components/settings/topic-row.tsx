"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Topic, TopicPatch } from "@/lib/types";

type Status = "saved" | "error" | null;

// Narrative row. Only the NAME is editable: PATCHing `query` on an
// AST-backed topic silently breaks its compiled GDELT query, so the old
// free-text query field is gone. `advanced` adds the active toggle and
// the AST editor link (Settings → Advanced).
export function TopicRow({
  topic,
  advanced = false,
}: {
  topic: Topic;
  advanced?: boolean;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(topic.name);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    setDraft(topic.name);
  }, [topic.id, topic.name]);

  useEffect(() => {
    if (status === null) return;
    const t = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(t);
  }, [status]);

  const mutation = useMutation({
    mutationFn: (patch: TopicPatch) => apiClient.updateTopic(topic.id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      setStatus("saved");
    },
    onError: () => {
      setStatus("error");
    },
  });

  const dirty = draft.trim() !== "" && draft !== topic.name;

  function toggleActive() {
    mutation.mutate({ is_active: !topic.is_active });
  }

  function handleSave() {
    if (!dirty) return;
    mutation.mutate({ name: draft.trim() }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["topics"] });
        queryClient.invalidateQueries({ queryKey: ["overview"] });
        setExpanded(false);
        setStatus("saved");
      },
    });
  }

  function handleCancel() {
    setDraft(topic.name);
    setExpanded(false);
  }

  return (
    <li className="border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0",
              topic.is_active ? "bg-emerald-400" : "bg-strong",
            )}
          />
          <span className="text-sm text-foreground">{topic.name}</span>
          {topic.role === "pool" && (
            <span className="border border-border px-1 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
              pool
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status && <StatusFlash kind={status} />}
          {advanced && (
          <button
            type="button"
            onClick={toggleActive}
            disabled={mutation.isPending}
            className={cn(
              "border px-2 py-1 font-mono text-[11px] transition-colors",
              topic.is_active
                ? "border-emerald-900 bg-emerald-950 text-emerald-400 hover:border-emerald-800"
                : "border-border bg-elevated text-text-tertiary hover:border-strong hover:text-text-secondary",
              mutation.isPending && "opacity-50",
            )}
          >
            {topic.is_active ? "Active" : "Inactive"}
          </button>
          )}
          {advanced && topic.topic_ast && (
            <Link
              href={`/settings/topics/${topic.id}/ast`}
              className="cursor-pointer border border-border bg-card px-2 py-1 font-mono text-[11px] text-text-tertiary hover:border-strong hover:text-foreground"
            >
              Edit AST
            </Link>
          )}
          {!advanced && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="cursor-pointer border border-border bg-card px-2 py-1 font-mono text-[11px] text-text-tertiary hover:border-strong hover:text-foreground"
            >
              Rename
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mb-3 border-l-2 border-border bg-card px-4 py-4">
          <div className="space-y-3">
            <Field label="Name" value={draft} onChange={setDraft} />
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="cursor-pointer border border-border bg-card px-3 py-1 font-mono text-[11px] text-text-tertiary hover:border-strong hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || mutation.isPending}
              className={cn(
                "border px-3 py-1 font-mono text-[11px] transition-colors",
                !dirty || mutation.isPending
                  ? "cursor-not-allowed border-border bg-card text-text-tertiary"
                  : "cursor-pointer border-strong bg-foreground text-primary-foreground hover:bg-text-secondary",
              )}
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 h-8 w-full border border-border bg-card px-2",
          "font-mono text-[11px] text-foreground placeholder:text-text-tertiary",
          "outline-none transition-colors hover:border-strong focus:border-strong",
        )}
      />
    </label>
  );
}

function StatusFlash({ kind }: { kind: "saved" | "error" }) {
  return (
    <span
      className={cn(
        "font-mono text-[11px]",
        kind === "saved" ? "text-emerald-400" : "text-red-400",
      )}
    >
      {kind === "saved" ? "Saved" : "Failed · retry"}
    </span>
  );
}
