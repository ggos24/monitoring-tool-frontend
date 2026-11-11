"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import {
  activeSubtopics,
  allTerms,
  ANY_ENDING_NOTE,
  autoAcceptLabel,
  buildSteps,
  formatAgo,
  formatEvery,
  hasAnyEnding,
  plural,
  syncState,
  waitingItems,
  wordGroupTitle,
  type RuleStep,
} from "@/lib/narrative-rules";
import type { Narrative, TopicPatch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KickerLabel } from "@/components/ui/kicker-label";

import { Dialog, DialogButtons } from "./dialog";
import { TermList } from "./term-list";

type Status = "collecting" | "paused" | "not_ready";

// "Collecting" only when new pool articles really reach it: an active
// narrative that is not set up yet gets nothing.
function statusOf(n: Narrative): Status {
  if (!n.is_active) return "paused";
  return n.fanout_ready ? "collecting" : "not_ready";
}

const STATUS_LABEL: Record<Status, string> = {
  collecting: "Collecting",
  paused: "Paused",
  not_ready: "Not collecting",
};

export function NarrativeCard({
  narrative: n,
  intervalSeconds,
}: {
  narrative: Narrative;
  intervalSeconds: number;
}) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"rename" | "pause" | "resume" | null>(null);
  const [draft, setDraft] = useState(n.name);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (patch: TopicPatch) => apiClient.updateTopic(n.topic_id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["narratives"] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      queryClient.invalidateQueries({ queryKey: ["topic-groups"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      setDialog(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not save. Try again."),
  });

  function open(kind: "rename" | "pause" | "resume") {
    setError(null);
    setDraft(n.name);
    setDialog(kind);
  }

  const status = statusOf(n);
  const every = formatEvery(intervalSeconds);
  const steps = buildSteps(n.rules);
  const covers = activeSubtopics(n.subtopics);
  const waiting = waitingItems(n.subtopics, n.waiting_terms);
  const sync = syncState(n.spec);
  const trimmed = draft.trim();
  const renameDirty = trimmed !== "" && trimmed !== n.name;

  return (
    <article
      id={`narrative-${n.topic_id}`}
      className="scroll-mt-16 bg-card p-5"
      aria-labelledby={`narrative-${n.topic_id}-name`}
    >
      {/* Name, status, actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`narrative-${n.topic_id}-name`} className="text-sm font-medium text-foreground">
              {n.name}
            </h3>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-mono text-[11px]",
                status === "collecting" ? "text-success" : "text-text-tertiary",
              )}
            >
              <span
                aria-hidden
                className={cn("size-1.5", status === "collecting" ? "bg-success" : "bg-strong")}
              />
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-text-tertiary tabular-nums">
            {plural(n.mentions_count, "article", "articles")} ·{" "}
            {n.mentions_7d.toLocaleString("en-US")} in the last 7 days · last added{" "}
            {formatAgo(n.last_added_at)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ActionButton onClick={() => open("rename")}>Rename</ActionButton>
          {n.is_active ? (
            <ActionButton onClick={() => open("pause")}>Pause</ActionButton>
          ) : n.fanout_ready ? (
            <ActionButton onClick={() => open("resume")}>Resume</ActionButton>
          ) : null}
        </div>
      </div>

      {!n.fanout_ready && (
        <p className="mt-3 border-l-2 border-warning pl-3 text-xs text-text-secondary">
          Not set up to collect yet — a developer must load it once.
        </p>
      )}

      {/* How an article gets in */}
      <div className="mt-5">
        <KickerLabel>How an article gets in</KickerLabel>

        {n.rules.auto_accept_axes.length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-text-secondary">
            Taken automatically, without the steps below:{" "}
            {n.rules.auto_accept_axes.map(autoAcceptLabel).join("; ")}.
          </p>
        )}

        <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-text-secondary">
          {steps.map((step, i) => (
            <li key={step.kind} className="flex gap-2">
              <span className="w-4 shrink-0 font-mono text-[11px] text-text-tertiary tabular-nums">
                {i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <StepBody step={step} />
              </div>
            </li>
          ))}
        </ol>

        {hasAnyEnding(allTerms(n.rules)) && (
          <p className="mt-2.5 text-[11px] text-text-tertiary">{ANY_ENDING_NOTE}</p>
        )}
      </div>

      {/* Subtopics */}
      {(covers.length > 0 || waiting.length > 0) && (
        <div className="mt-5 space-y-2 text-xs leading-relaxed">
          {covers.length > 0 && (
            <p className="text-text-secondary">
              <span className="text-text-tertiary">Covers: </span>
              {covers.map((s, i) => (
                <span key={s.name}>
                  {i > 0 && <span className="text-text-tertiary"> · </span>}
                  <span title={s.description ?? undefined}>{s.name}</span>
                </span>
              ))}
            </p>
          )}
          {waiting.length > 0 && (
            <p className="text-text-secondary">
              <span className="text-text-tertiary">
                Waiting for an editors&rsquo; decision — not used yet:{" "}
              </span>
              {waiting.map((w, i) => (
                <span key={w.name}>
                  {i > 0 && <span className="text-text-tertiary"> · </span>}
                  {w.name}
                  {w.count !== null && (
                    <span className="font-mono text-[11px] text-text-tertiary">
                      {" "}
                      ({plural(w.count, "phrase", "phrases")})
                    </span>
                  )}
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      {/* Facts and how rules change */}
      <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-xs leading-relaxed">
        <p className="text-text-secondary">
          <span className="text-text-tertiary">Shown under All queries on the dashboard: </span>
          {n.in_campaign_group ? "Yes" : "No"}
        </p>
        {sync === "in_sync" && n.spec && (
          <p className="text-success">
            Same as the reviewed file <span className="font-mono text-[11px]">{n.spec.file}</span>
          </p>
        )}
        {sync === "differs" && (
          <p className="text-danger">Live rules differ from the reviewed file — ask a developer.</p>
        )}
        <p className="text-text-tertiary">
          {n.spec ? (
            <>
              Rules are changed by the team in the reviewed file{" "}
              <span className="font-mono text-[11px] text-text-secondary">{n.spec.file}</span>.
            </>
          ) : (
            <>Rules are changed by the team in a reviewed file.</>
          )}{" "}
          Send examples of articles that should or shouldn&rsquo;t be in, with links.
        </p>
      </div>

      {/* Dialogs */}
      <Dialog open={dialog === "rename"} onClose={() => setDialog(null)} title="Rename query">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            Name
          </span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameDirty && !mutation.isPending) {
                mutation.mutate({ name: trimmed });
              }
            }}
            maxLength={200}
            autoFocus
            className={cn(
              "mt-1 h-8 w-full border border-border bg-card px-2",
              "text-sm text-foreground outline-none transition-colors hover:border-strong focus:border-strong",
            )}
          />
        </label>
        <p className="mt-2 text-xs text-text-tertiary">
          Changes the display name only. Rules and articles are not affected.
        </p>
        <DialogError message={error} />
        <DialogButtons
          confirmLabel="Save name"
          pendingLabel="Saving…"
          pending={mutation.isPending}
          disabled={!renameDirty}
          onCancel={() => setDialog(null)}
          onConfirm={() => mutation.mutate({ name: trimmed })}
        />
      </Dialog>

      <Dialog open={dialog === "pause"} onClose={() => setDialog(null)} title="Pause this query?">
        <p className="text-xs leading-relaxed text-text-secondary">
          It keeps its {plural(n.mentions_count, "article", "articles")} but gets no new ones
          from the next update (within {every}). Nothing else changes.
        </p>
        <DialogError message={error} />
        <DialogButtons
          confirmLabel="Pause"
          pendingLabel="Pausing…"
          pending={mutation.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={() => mutation.mutate({ is_active: false })}
        />
      </Dialog>

      <Dialog open={dialog === "resume"} onClose={() => setDialog(null)} title="Resume this query?">
        <p className="text-xs leading-relaxed text-text-secondary">
          It starts checking NEW pool articles from the next update (within {every}). Older
          pool articles are only added when the team re-checks the pool — ask a developer.
        </p>
        <DialogError message={error} />
        <DialogButtons
          confirmLabel="Resume"
          pendingLabel="Resuming…"
          pending={mutation.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={() => mutation.mutate({ is_active: true })}
        />
      </Dialog>
    </article>
  );
}

function StepBody({ step }: { step: RuleStep }) {
  if (step.kind === "word_groups") {
    return (
      <>
        <span>{step.text}{step.groups.length > 0 ? ":" : ""}</span>
        {step.groups.length > 0 && (
          <ul className="mt-1.5 space-y-1.5">
            {step.groups.map((g, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-text-tertiary">•</span>
                <span className="min-w-0">
                  <span className="text-foreground">{wordGroupTitle(g, i)}</span>
                  <span className="text-text-tertiary">: </span>
                  <TermList terms={g.terms} limit={10} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }
  return (
    <>
      <span>
        {step.text}
        {step.terms.length > 0 ? ": " : ""}
      </span>
      <TermList terms={step.terms} quoted={step.kind === "key_phrases"} />
    </>
  );
}

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer border border-border bg-card px-2 py-1 font-mono text-[11px] text-text-tertiary hover:border-strong hover:text-foreground"
    >
      {children}
    </button>
  );
}

function DialogError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 border border-danger px-3 py-2 font-mono text-[11px] text-danger">
      {message}
    </p>
  );
}
