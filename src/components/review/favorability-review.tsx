"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ExternalLink, X } from "lucide-react";

import { EditorBadge, EditorGate, useEditorName } from "@/components/review/editor-gate";
import { apiClient } from "@/lib/api";
import {
  EMPTY_FAV_DRAFT,
  QUESTIONS,
  compareAnswers,
  draftScore,
  isComplete,
  type FavDraft,
} from "@/lib/favorability-review";
import { articleNumber, progressPercent } from "@/lib/review";
import { signed } from "@/lib/score-explanation";
import type { FavBatch, FavItem, FavLabel, FavReveal } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:pointer-events-none disabled:opacity-40";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 border border-strong px-4 text-sm text-text-secondary transition-colors hover:text-foreground";

/** /review/favorability — editors answer the model's questions blind. */
export function FavorabilityReview() {
  const [editor, setEditor, ready] = useEditorName();
  if (!ready) return null;
  if (!editor) return <EditorGate onSubmit={setEditor} />;
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <EditorBadge name={editor} onChange={() => setEditor(null)} />
      </div>
      <Batches editor={editor} />
    </div>
  );
}

function Batches({ editor }: { editor: string }) {
  const batchesQ = useQuery({
    queryKey: ["fav-batches", editor],
    queryFn: () => apiClient.favBatches(editor),
  });
  const [picked, setPicked] = useState<number | null>(null);
  const batches = batchesQ.data ?? [];
  const batch =
    batches.find((b) => b.id === picked) ??
    batches.find((b) => b.progress.done < b.progress.total) ??
    batches[0];

  if (batchesQ.isLoading) return <p className="text-sm text-text-tertiary">Loading…</p>;
  if (batchesQ.error)
    return <p className="text-sm text-danger">Something went wrong: {String(batchesQ.error)}</p>;
  if (!batch)
    return (
      <section className="max-w-xl border border-border bg-card p-5 text-sm text-text-secondary">
        No articles to check yet. A new set appears here once it is prepared.
      </section>
    );
  return (
    <div className="space-y-5">
      {batches.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setPicked(b.id)}
              className={cn(SECONDARY, "h-8 px-3", b.id === batch.id && "border-foreground text-foreground")}
            >
              {b.title} · {b.progress.done}/{b.progress.total}
            </button>
          ))}
        </div>
      )}
      <Labelling key={batch.id} editor={editor} batch={batch} />
    </div>
  );
}

type Current = { item: FavItem; saved: { mine: FavLabel; reveal: FavReveal } | null };

function Labelling({ editor, batch }: { editor: string; batch: FavBatch }) {
  const qc = useQueryClient();
  const [after, setAfter] = useState(-1);
  const [current, setCurrent] = useState<Current | null>(null);
  const [draft, setDraft] = useState<FavDraft>(EMPTY_FAV_DRAFT);

  const nextQ = useQuery({
    queryKey: ["fav-next", batch.id, editor, after],
    queryFn: () => apiClient.favNext(batch.id, editor, after),
    staleTime: Infinity,
  });
  // A fresh article from the queue replaces the screen unless one is saved.
  useEffect(() => {
    const item = nextQ.data?.item;
    setCurrent((cur) => (cur?.saved ? cur : item ? { item, saved: null } : null));
    setDraft(EMPTY_FAV_DRAFT);
  }, [nextQ.data]);

  const save = useMutation({
    mutationFn: () => {
      if (!current || !isComplete(draft)) throw new Error("answer all four questions");
      return apiClient.saveFavLabel(current.item.id, {
        editor,
        fact_status: draft.fact_status,
        actor: draft.actor,
        direction: draft.direction,
        coverage: draft.coverage,
        comment: draft.comment.trim() || null,
      });
    },
    onSuccess: (result) => {
      if (current) setCurrent({ item: current.item, saved: result });
      qc.invalidateQueries({ queryKey: ["fav-batches"] });
    },
  });

  const goNext = async () => {
    const next = await qc.fetchQuery({
      queryKey: ["fav-next", batch.id, editor, -1, Date.now()],
      queryFn: () => apiClient.favNext(batch.id, editor, -1),
    });
    setAfter(-1);
    setCurrent(next.item ? { item: next.item, saved: null } : null);
    setDraft(EMPTY_FAV_DRAFT);
    save.reset();
  };

  const progress = nextQ.data?.progress ?? batch.progress;
  const finished = !nextQ.isLoading && !nextQ.data?.item && !current;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-text-tertiary">{batch.title}</p>
            <h2 className="mt-1 text-lg leading-snug text-foreground">
              Is the news good or bad for Ukraine?
            </h2>
          </div>
          {progress.total > 0 && (
            <p className="text-sm text-text-secondary">
              {finished
                ? `${progress.total} of ${progress.total}`
                : `Article ${articleNumber(progress.done, progress.total)} of ${progress.total}`}
            </p>
          )}
        </div>
        <div className="h-1.5 w-full bg-elevated">
          <div
            className="h-1.5 bg-success transition-all"
            style={{ width: `${progressPercent(progress.done, progress.total)}%` }}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {nextQ.isLoading && <p className="text-sm text-text-tertiary">Loading the next article…</p>}
          {nextQ.error && (
            <p className="text-sm text-danger">Something went wrong: {String(nextQ.error)}</p>
          )}
          {finished && (
            <section className="border border-border bg-card p-6">
              <h3 className="text-base font-medium text-foreground">All done here. Thank you!</h3>
              <p className="mt-1 text-sm text-text-secondary">
                You have answered every article in this set.
              </p>
            </section>
          )}
          {current && (
            <>
              <ArticleCard item={current.item} />
              {current.saved ? (
                <RevealCard saved={current.saved} onNext={goNext} />
              ) : (
                <QuestionsCard
                  draft={draft}
                  setDraft={setDraft}
                  onSave={() => save.mutate()}
                  saving={save.isPending}
                  error={save.error}
                  onSkip={() => setAfter(current.item.position)}
                />
              )}
            </>
          )}
        </div>
        <Guide />
      </div>
    </div>
  );
}

function ArticleCard({ item }: { item: FavItem }) {
  return (
    <section className="border border-border bg-card p-5">
      <p className="text-xs text-text-tertiary">
        <span className="text-text-secondary">{item.outlet ?? "Unknown outlet"}</span>
        {item.published_date && <> · {item.published_date}</>}
        {item.narrative && <> · query: {item.narrative}</>}
      </p>
      <h3 className="mt-2 text-xl leading-snug text-foreground">{item.headline}</h3>
      {item.opening ? (
        <>
          <p className="mt-4 text-xs text-text-tertiary">Beginning of the article</p>
          <p className="mt-1 max-h-52 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-text-secondary">
            {item.opening}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-text-tertiary">
          We only have the headline. If it is not enough to decide, open the article.
        </p>
      )}
      <a href={item.url} target="_blank" rel="noopener noreferrer" className={cn(SECONDARY, "mt-4 h-9")}>
        Open the article <ExternalLink className="size-3.5" />
      </a>
    </section>
  );
}

function QuestionsCard({
  draft,
  setDraft,
  onSave,
  saving,
  error,
  onSkip,
}: {
  draft: FavDraft;
  setDraft: (d: FavDraft) => void;
  onSave: () => void;
  saving: boolean;
  error: Error | null;
  onSkip: () => void;
}) {
  const score = draftScore(draft);
  return (
    <section className="space-y-5 border border-border bg-card p-5">
      {QUESTIONS.map((q, i) => (
        <fieldset key={q.key}>
          <legend className="text-sm font-medium text-foreground">
            {i + 1}. {q.title}
          </legend>
          <p className="mt-0.5 text-xs text-text-tertiary">{q.help}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {q.options.map((o) => {
              const active = draft[q.key] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraft({ ...draft, [q.key]: o.value })}
                  className={cn(
                    "border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-foreground bg-elevated text-foreground"
                      : "border-border text-text-secondary hover:border-strong hover:text-foreground",
                  )}
                >
                  <span className="block text-sm">{o.label}</span>
                  <span className="block text-xs text-text-tertiary">{o.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <label className="block">
        <span className="text-sm text-text-secondary">Comment (optional)</span>
        <textarea
          value={draft.comment}
          maxLength={1000}
          onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
          rows={2}
          className="mt-1 w-full border border-strong bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-text-tertiary"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={PRIMARY} disabled={score === null || saving} onClick={onSave}>
          {saving ? "Saving…" : "Save and compare"}
        </button>
        <button type="button" className={SECONDARY} onClick={onSkip}>
          Skip for now
        </button>
        <span className="text-sm text-text-tertiary">
          {score === null ? "Answer all four questions" : `Your answers give ${signed(score)}`}
        </span>
      </div>
      {error && <p className="text-sm text-danger">Could not save: {error.message}</p>}
    </section>
  );
}

function RevealCard({ saved, onNext }: { saved: { mine: FavLabel; reveal: FavReveal }; onNext: () => void }) {
  const { mine, reveal } = saved;
  const model = reveal.model;
  const rows = compareAnswers(mine, model);
  return (
    <section className="space-y-4 border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-sm text-text-secondary">
          Your score <span className="text-lg text-foreground">{signed(mine.score)}</span>
        </p>
        {model ? (
          <p className="text-sm text-text-secondary">
            Model <span className="text-lg text-foreground">{signed(model.score)}</span>
          </p>
        ) : (
          <p className="text-sm text-text-tertiary">
            The model has not scored this article with the new questions yet.
          </p>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-text-tertiary">
            <th className="py-1 font-normal">Question</th>
            <th className="py-1 font-normal">You</th>
            <th className="py-1 font-normal">Model</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="py-1.5 pr-3 text-text-tertiary">
                {QUESTIONS.find((q) => q.key === r.key)?.title}
              </td>
              <td className="py-1.5 pr-3 text-foreground">{r.mine}</td>
              <td className="py-1.5">
                {r.model === null ? (
                  <span className="text-text-tertiary">—</span>
                ) : (
                  <span className={cn("inline-flex items-center gap-1", r.same ? "text-success" : "text-warning")}>
                    {r.same ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                    {r.model}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {model && (model.event || model.evidence || model.reasoning) && (
        <div className="space-y-1.5 text-sm text-text-secondary">
          {model.event && (
            <p>
              <span className="text-text-tertiary">Model saw: </span>
              {model.event}
            </p>
          )}
          {model.evidence && (
            <p className="border-l-2 border-strong pl-2 italic">
              “{model.evidence}”
              {model.evidence_verified !== null && (
                <span className={cn("not-italic", model.evidence_verified ? "text-success" : "text-warning")}>
                  {model.evidence_verified ? " · found in the article" : " · not found in the article"}
                </span>
              )}
            </p>
          )}
          {model.reasoning && (
            <p>
              <span className="text-text-tertiary">Model's reasoning: </span>
              {model.reasoning}
            </p>
          )}
        </div>
      )}

      {reveal.others.length > 0 && (
        <div className="text-sm text-text-secondary">
          <p className="text-text-tertiary">Other editors</p>
          {reveal.others.map((o) => (
            <p key={o.editor}>
              {o.editor}: {signed(o.score)}
              {o.comment && <span className="text-text-tertiary"> — {o.comment}</span>}
            </p>
          ))}
        </div>
      )}

      <button type="button" className={PRIMARY} onClick={onNext}>
        Next article <ArrowRight className="size-4" />
      </button>
    </section>
  );
}

function Guide() {
  return (
    <aside className="h-fit space-y-3 border border-border bg-card p-4 text-sm text-text-secondary">
      <h3 className="text-sm font-medium text-foreground">How the score works</h3>
      <p>
        Decisions of <span className="text-foreground">another state or an international
        body</span> weigh most. Confirmed war events, Russia's actions and Ukrainian news count,
        but weaker. If the article has a partner's step, that is the main event.
      </p>
      <ul className="space-y-1 text-xs">
        <li>Confirmed and helps: <span className="text-foreground">+2</span></li>
        <li>Announced or opinion, helps: <span className="text-foreground">+1</span></li>
        <li>Announced or opinion, harms: <span className="text-foreground">−1</span></li>
        <li>Confirmed and harms: <span className="text-foreground">−2</span></li>
        <li>Confirmed strike, battle, Russia's or Ukraine's own action: <span className="text-foreground">±1</span></li>
        <li>Unconfirmed war news, both ways, or nothing happened: <span className="text-foreground">0</span></li>
      </ul>
      <p className="text-xs text-text-tertiary">
        Examples: “EU adopts sanctions” +2, “EU to discuss sanctions” +1, “Hungary blocks EU
        loan” −2, “Russian missiles hit Kyiv” −1, the same strike plus “Britain sends new Storm
        Shadow missiles” +2.
      </p>
      <p className="text-xs text-text-tertiary">
        You see the model's answers only after you save. Answer from the article, not from what
        you know happened later.
      </p>
    </aside>
  );
}
