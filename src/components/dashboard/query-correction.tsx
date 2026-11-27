"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { apiClient } from "@/lib/api";
import { cleanEditorName } from "@/lib/review";
import {
  CORRECTION_REASONS,
  MOVE_REASON,
  explainQueryReason,
} from "@/lib/query-reason";
import type { CorrectionReasonCode, Mention, QueryReason } from "@/lib/types";
import { useEditorName } from "@/components/review/editor-gate";
import { cn } from "@/lib/utils";

type Draft = {
  topicId: number;
  mode: "move" | "remove";
  to: number | null;
  reason: CorrectionReasonCode;
  note: string;
};

/**
 * "Why is it in this query" + move / remove actions, inside the article
 * hover card. One entry per query the article is in (several in "All
 * queries" scope). Every action is recorded by the backend together with
 * the algorithm's original verdict.
 */
export function QueryReasonsBlock({
  mention,
  topicNames,
  onEditingChange,
}: {
  mention: Mention;
  /** All queries (id → name): labels and move targets. */
  topicNames: Map<number, string>;
  /** Keeps the hover card open while a form is open. */
  onEditingChange: (editing: boolean) => void;
}) {
  const reasons: QueryReason[] =
    mention.query_reasons && mention.query_reasons.length > 0
      ? mention.query_reasons
      : [
          {
            topic_id: mention.topic_id,
            mention_id: mention.id,
            method: mention.relevance_method,
            score: mention.relevance_score,
            reason: mention.relevance_reason,
          },
        ];
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const setDraft = (d: Draft | null) => {
    setDraftState(d);
    onEditingChange(d !== null);
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      {reasons.map((r) => {
        const e = explainQueryReason(r.method, r.reason);
        const name = topicNames.get(r.topic_id) ?? `Query #${r.topic_id}`;
        const open = draft?.topicId === r.topic_id;
        return (
          <div key={r.topic_id} className="flex flex-col gap-1">
            {/* Raw matcher rule only on hover: it is for debugging, not reading. */}
            <div title={r.reason ? `${e.source} — rule: ${r.reason}` : e.source}>
              <span className="text-text-tertiary">
                In {reasons.length > 1 ? `“${name}”` : "this query"}:{" "}
              </span>
              <span className="text-foreground">{e.detail}</span>
            </div>
            {open ? (
              <CorrectionForm
                draft={draft}
                mentionId={mention.id}
                fromName={name}
                topicNames={topicNames}
                onChange={setDraft}
                onDone={(msg) => {
                  setDraft(null);
                  setDone(msg);
                }}
              />
            ) : (
              !done && (
                <div className="flex gap-1.5">
                  <ActionButton
                    onClick={() =>
                      setDraft({
                        topicId: r.topic_id,
                        mode: "move",
                        to: null,
                        reason: MOVE_REASON.code,
                        note: "",
                      })
                    }
                  >
                    Move
                  </ActionButton>
                  <ActionButton
                    onClick={() =>
                      setDraft({
                        topicId: r.topic_id,
                        mode: "remove",
                        to: null,
                        reason: "off_topic",
                        note: "",
                      })
                    }
                  >
                    Remove
                  </ActionButton>
                </div>
              )
            )}
          </div>
        );
      })}
      {done && <div className="text-success">{done}</div>}
    </div>
  );
}

function CorrectionForm({
  draft,
  mentionId,
  fromName,
  topicNames,
  onChange,
  onDone,
}: {
  draft: Draft;
  mentionId: number;
  fromName: string;
  topicNames: Map<number, string>;
  onChange: (d: Draft | null) => void;
  onDone: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editor, setEditor, ready] = useEditorName();
  const [nameInput, setNameInput] = useState("");
  const name = editor ?? cleanEditorName(nameInput);
  const targets = [...topicNames.entries()].filter(([id]) => id !== draft.topicId);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.correctQuery(mentionId, {
        from_topic_id: draft.topicId,
        to_topic_id: draft.mode === "move" ? draft.to : null,
        reason_code: draft.reason,
        note: draft.note.trim() || null,
        editor: name!,
      }),
    onSuccess: () => {
      if (!editor && name) setEditor(name);
      onDone(
        draft.mode === "move"
          ? `Moved to ${topicNames.get(draft.to!) ?? "the query"}. Saved.`
          : `Removed from ${fromName}. Saved.`,
      );
      // Counts, charts and lists all change.
      void queryClient.invalidateQueries();
    },
  });

  const canSave =
    !!name && !mutation.isPending && (draft.mode === "remove" || draft.to !== null);
  const field =
    "h-7 w-full border border-strong bg-background px-2 text-[11px] text-foreground outline-none focus:border-text-tertiary";

  return (
    <form
      className="mt-1 flex flex-col gap-1.5 border border-border bg-card p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) mutation.mutate();
      }}
    >
      <div className="text-foreground">
        {draft.mode === "move" ? `Move out of ${fromName}` : `Remove from ${fromName}`}
      </div>
      {draft.mode === "move" ? (
        <select
          aria-label="Target query"
          className={field}
          value={draft.to ?? ""}
          onChange={(e) => onChange({ ...draft, to: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Choose the query…</option>
          {targets.map(([id, n]) => (
            <option key={id} value={id}>
              {n}
            </option>
          ))}
        </select>
      ) : (
        <select
          aria-label="Reason"
          className={field}
          value={draft.reason}
          onChange={(e) => onChange({ ...draft, reason: e.target.value as CorrectionReasonCode })}
        >
          {CORRECTION_REASONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
      )}
      <input
        aria-label="Comment"
        className={field}
        maxLength={1000}
        placeholder="Comment (optional)"
        value={draft.note}
        onChange={(e) => onChange({ ...draft, note: e.target.value })}
      />
      {ready && !editor && (
        <input
          aria-label="Your name"
          className={field}
          maxLength={64}
          placeholder="Your name (saved in this browser)"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
        />
      )}
      {mutation.error && (
        <div className="text-danger">
          {mutation.error instanceof Error ? mutation.error.message : "Saving failed"}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <ActionButton type="submit" disabled={!canSave} primary>
          {mutation.isPending ? <Loader2 className="size-3 animate-spin" /> : "Save"}
        </ActionButton>
        <ActionButton onClick={() => onChange(null)} disabled={mutation.isPending}>
          Cancel
        </ActionButton>
        {editor && <span className="ml-auto text-text-tertiary">as {editor}</span>}
      </div>
    </form>
  );
}

function ActionButton({
  children,
  onClick,
  type = "button",
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-6 cursor-pointer items-center border px-2 text-[11px] transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "border-strong bg-foreground text-background hover:opacity-90"
          : "border-border bg-card text-text-secondary hover:border-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
