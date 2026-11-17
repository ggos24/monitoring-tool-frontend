"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, ExternalLink } from "lucide-react";

import { KickerLabel } from "@/components/ui/kicker-label";
import { ApiError, apiClient } from "@/lib/api";
import {
  EMPTY_DRAFT,
  MAX_COMMENT,
  VERDICT_CHOICE,
  VERDICT_HELP,
  applySubtopic,
  applyVerdict,
  articleNumber,
  isTypingTarget,
  judgeLabel,
  keyToAction,
  progressPercent,
  queryKey,
  systemIncluded,
  taskHref,
  type Draft,
  type VerdictValue,
} from "@/lib/review";
import type { ReviewItem, ReviewLabel, ReviewQuery, ReviewReveal } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { editor: string; batchId: number; queryNumber: number; part: number };

/** What is on screen: the next article in the queue, or one the editor went back to. */
type Current = {
  item: ReviewItem;
  saved: { mine: ReviewLabel; reveal: ReviewReveal; betterFit: number | null } | null;
  editing: boolean; // true = the question is open (new article, or "Change my answer")
};

export function Labelling({ editor, batchId, queryNumber, part }: Props) {
  const qc = useQueryClient();
  const queriesQ = useQuery({ queryKey: ["review-queries"], queryFn: apiClient.reviewQueries });
  const query = queriesQ.data?.queries.find((q) => q.number === queryNumber && q.topic_id !== null);
  const topicId = query?.topic_id ?? null;
  const otherQueries = (queriesQ.data?.queries ?? []).filter(
    (q) => q.topic_id !== null && q.number !== queryNumber,
  );
  /** The query this editor said fits better, from their saved labels. */
  const betterFitOf = (labels: ReviewLabel[]) =>
    labels.find((l) => l.via_topic_id === topicId)?.topic_id ?? null;

  const batchesQ = useQuery({
    queryKey: ["review-batches", editor, [topicId]],
    queryFn: () => apiClient.reviewBatches(editor, [topicId as number]),
    enabled: topicId !== null,
  });
  const batch = batchesQ.data?.find((b) => b.id === batchId);
  const round = batch?.rounds.find((r) => r.round === part);
  const hasMore = !!batch?.rounds.find((r) => r.round === part + 1 && r.done < r.total);

  const [after, setAfter] = useState(-1);
  const nextQ = useQuery({
    queryKey: ["review-next", batchId, editor, topicId, part, after],
    queryFn: () =>
      apiClient.reviewNext(batchId, { editor, topics: [topicId as number], round: part, after }),
    enabled: topicId !== null,
    staleTime: Infinity,
  });

  // History of articles saved in this visit, for "Previous".
  const [history, setHistory] = useState<number[]>([]);
  const [current, setCurrent] = useState<Current | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  // A fresh article from the queue replaces the screen unless we are on a saved one.
  useEffect(() => {
    const item = nextQ.data?.item;
    // Keep a saved article (or one being changed) on screen until "Next".
    setCurrent((cur) => (cur?.saved ? cur : item ? { item, saved: null, editing: true } : null));
  }, [nextQ.data]);
  useEffect(() => {
    if (current?.editing && !current.saved) setDraft(EMPTY_DRAFT);
  }, [current?.item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () =>
      apiClient.saveReviewLabels(current!.item.id, editor, [
        {
          topic_id: topicId as number,
          verdict: draft.verdict as VerdictValue,
          subtopic: draft.verdict === "no" ? null : draft.subtopic,
          comment: draft.comment.trim() || null,
        },
      ], {
        taskTopicId: topicId as number,
        betterFitTopicId: draft.verdict === "yes" ? null : (draft.betterFit ?? null),
      }),
    onSuccess: (result) => {
      const mine = result.mine.find((l) => l.topic_id === topicId);
      if (!current || !mine) return;
      setCurrent({
        item: current.item,
        saved: { mine, reveal: result.reveal, betterFit: betterFitOf(result.mine) },
        editing: false,
      });
      setHistory((h) => (h.includes(current.item.id) ? h : [...h, current.item.id]));
      qc.invalidateQueries({ queryKey: ["review-batches"] });
    },
  });

  const goNext = useCallback(async () => {
    setCurrent(null);
    setDraft(EMPTY_DRAFT);
    setAfter(-1);
    // Fetch directly: the cached answer can look identical to the old one.
    const next = await qc.fetchQuery({
      queryKey: ["review-next", batchId, editor, topicId, part, -1],
      queryFn: () =>
        apiClient.reviewNext(batchId, { editor, topics: [topicId as number], round: part, after: -1 }),
      staleTime: 0,
    });
    setCurrent(next.item ? { item: next.item, saved: null, editing: true } : null);
  }, [qc, batchId, editor, topicId, part]);

  const skip = useCallback(() => {
    if (current && !current.saved) setAfter(current.item.position);
  }, [current]);

  const goPrevious = useCallback(async () => {
    const idx = current?.saved ? history.indexOf(current.item.id) - 1 : history.length - 1;
    const id = history[idx];
    if (id === undefined) return;
    const detail = await apiClient.reviewItem(id, editor);
    const mine = detail.mine.find((l) => l.topic_id === topicId);
    if (mine && detail.reveal) {
      setCurrent({
        item: detail.item,
        saved: { mine, reveal: detail.reveal, betterFit: betterFitOf(detail.mine) },
        editing: false,
      });
    }
  }, [current, history, editor, topicId]);

  const changeAnswer = useCallback(() => {
    if (!current?.saved) return;
    const m = current.saved.mine;
    setDraft({
      verdict: m.verdict,
      subtopic: m.subtopic,
      comment: m.comment ?? "",
      betterFit: current.saved.betterFit,
    });
    setCurrent({ ...current, editing: true });
  }, [current]);

  const canSave = !!current?.editing && draft.verdict !== null && !save.isPending;

  // Keyboard (optional; everything also works with the mouse).
  const ref = useRef({ current, canSave, query });
  ref.current = { current, canSave, query };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target as HTMLElement)) return;
      const action = keyToAction(e.key);
      const s = ref.current;
      if (!action || !s.current) return;
      if (action.type === "open") window.open(s.current.item.url, "_blank", "noopener,noreferrer");
      else if (action.type === "save") {
        if (s.current.editing) {
          if (s.canSave) save.mutate();
        } else goNext();
      } else if (!s.current.editing) return;
      else if (action.type === "verdict") setDraft((d) => applyVerdict(d, action.verdict));
      else if (action.type === "subtopic" && s.query && action.subtopic <= s.query.subtopics.length)
        setDraft((d) => (d.verdict === "yes" || d.verdict === "border" ? applySubtopic(d, action.subtopic) : d));
      else if (action.type === "skip") skip();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, save, skip]);

  const total = round?.total ?? 0;
  const done = round?.done ?? 0;
  const finished = !nextQ.isLoading && !nextQ.data?.item && !current;
  const canGoBack =
    history.length > 0 && (!current?.saved || history.indexOf(current.item.id) > 0);

  return (
    <div className="space-y-5">
      {/* header: where am I */}
      <div className="space-y-3">
        <Link
          href="/review"
          className="inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All tasks
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-text-tertiary">
              {batch?.title ?? "…"}
              {part > 1 ? " · more articles" : ""}
            </p>
            <h2 className="mt-1 text-lg leading-snug text-foreground">
              Query {queryNumber}: {query?.title ?? "…"}
            </h2>
          </div>
          {total > 0 && (
            <p className="text-sm text-text-secondary">
              {finished ? `${total} of ${total}` : `Article ${articleNumber(done, total)} of ${total}`}
            </p>
          )}
        </div>
        <div className="h-1.5 w-full bg-elevated">
          <div className="h-1.5 bg-success transition-all" style={{ width: `${progressPercent(done, total)}%` }} />
        </div>
      </div>

      {(queriesQ.error || nextQ.error) && (
        <p className="text-sm text-danger">Something went wrong: {String(queriesQ.error ?? nextQ.error)}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {nextQ.isLoading && !current && <p className="text-sm text-text-tertiary">Loading the next article…</p>}

          {finished && (
            <section className="border border-border bg-card p-6">
              <h3 className="text-base font-medium text-foreground">All done here. Thank you!</h3>
              <p className="mt-1 text-sm text-text-secondary">
                You have labelled every article in this task.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {hasMore && (
                  <Link href={taskHref(batchId, queryNumber, part + 1)} className={PRIMARY}>
                    Keep going with more articles <ArrowRight className="size-4" />
                  </Link>
                )}
                <Link href="/review" className={SECONDARY}>
                  Back to all tasks
                </Link>
              </div>
            </section>
          )}

          {current && query && (
            <>
              <ArticleCard item={current.item} />
              {current.editing ? (
                <QuestionCard
                  query={query}
                  otherQueries={otherQueries}
                  draft={draft}
                  setDraft={setDraft}
                  onSave={() => save.mutate()}
                  saving={save.isPending}
                  canSave={canSave}
                  error={save.error}
                  onSkip={current.saved ? null : skip}
                  onPrevious={canGoBack && !current.saved ? goPrevious : null}
                  isChange={!!current.saved}
                />
              ) : (
                current.saved && (
                  <SavedCard
                    query={query}
                    monthly={batch?.kind === "monthly"}
                    mine={current.saved.mine}
                    reveal={current.saved.reveal}
                    betterFit={otherQueries.find((q) => q.topic_id === current.saved!.betterFit) ?? null}
                    onNext={goNext}
                    onChange={changeAnswer}
                    onPrevious={canGoBack ? goPrevious : null}
                  />
                )
              )}
            </>
          )}
        </div>

        {query && <QueryGuide query={query} />}
      </div>
    </div>
  );
}

const PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:pointer-events-none disabled:opacity-40";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 border border-strong px-4 text-sm text-text-secondary transition-colors hover:text-foreground";

function ArticleCard({ item }: { item: ReviewItem }) {
  return (
    <section className="border border-border bg-card p-5">
      <p className="text-xs text-text-tertiary">
        <span className="text-text-secondary">{item.outlet ?? "Unknown outlet"}</span>
        {item.published_date && <> · {formatDate(item.published_date)}</>}
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

function QuestionCard({
  query,
  otherQueries,
  draft,
  setDraft,
  onSave,
  saving,
  canSave,
  error,
  onSkip,
  onPrevious,
  isChange,
}: {
  query: ReviewQuery;
  otherQueries: ReviewQuery[];
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  error: unknown;
  onSkip: (() => void) | null;
  onPrevious: (() => void) | null;
  isChange: boolean;
}) {
  return (
    <section className="space-y-5 border border-border bg-card p-5">
      <div>
        <h3 className="text-base font-medium text-foreground">Is this article about this query?</h3>
        <p className="mt-0.5 text-sm text-text-tertiary">{query.title}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Your answer">
        {(["yes", "border", "no"] as VerdictValue[]).map((v) => {
          const on = draft.verdict === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setDraft((d) => applyVerdict(d, v))}
              className={cn(
                "border p-3 text-left transition-colors",
                on
                  ? v === "yes"
                    ? "border-success bg-success/15"
                    : v === "border"
                      ? "border-warning bg-warning/15"
                      : "border-danger bg-danger/15"
                  : "border-strong hover:border-text-tertiary",
              )}
            >
              <span className="flex items-center justify-between text-sm font-medium text-foreground">
                {VERDICT_CHOICE[v]}
                {on && <Check className="size-4" />}
              </span>
              <span className="mt-1 block text-xs leading-snug text-text-tertiary">{VERDICT_HELP[v]}</span>
            </button>
          );
        })}
      </div>

      {draft.verdict && draft.verdict !== "no" && (
        <div>
          <p className="text-sm text-text-secondary">
            Which part of the query fits best? <span className="text-text-tertiary">(optional)</span>
          </p>
          <div className="mt-2 space-y-1" role="radiogroup" aria-label="Subtopic">
            {query.subtopics.map((s, i) => {
              const on = draft.subtopic === i + 1;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDraft((d) => applySubtopic(d, i + 1))}
                  className={cn(
                    "flex w-full items-start gap-3 border px-3 py-2 text-left text-sm transition-colors",
                    on
                      ? "border-text-secondary bg-elevated text-foreground"
                      : "border-border text-text-secondary hover:border-text-tertiary",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                      on ? "border-foreground" : "border-text-tertiary",
                    )}
                  >
                    {on && <span className="size-2 rounded-full bg-foreground" />}
                  </span>
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(draft.verdict === "no" || draft.verdict === "border") && otherQueries.length > 0 && (
        <div>
          <p className="text-sm text-text-secondary">
            Does it fit another query better? <span className="text-text-tertiary">(optional)</span>
          </p>
          <div className="mt-2 space-y-1" role="radiogroup" aria-label="Fits another query better">
            {[...otherQueries.map((q) => ({ id: q.topic_id as number, label: `Query ${q.number}: ${q.title}` })),
              { id: null as number | null, label: "No, none of them" }].map((opt) => {
              const on = (draft.betterFit ?? null) === opt.id;
              return (
                <button
                  key={opt.id ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDraft((d) => ({ ...d, betterFit: opt.id }))}
                  className={cn(
                    "flex w-full items-start gap-3 border px-3 py-2 text-left text-sm transition-colors",
                    on
                      ? "border-text-secondary bg-elevated text-foreground"
                      : "border-border text-text-secondary hover:border-text-tertiary",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                      on ? "border-foreground" : "border-text-tertiary",
                    )}
                  >
                    {on && <span className="size-2 rounded-full bg-foreground" />}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            We save it as a Yes for that query, so you will not see this article again there.
          </p>
        </div>
      )}

      <label className="block">
        <span className="text-sm text-text-secondary">
          Comment <span className="text-text-tertiary">(optional)</span>
        </span>
        <textarea
          value={draft.comment}
          maxLength={MAX_COMMENT}
          onChange={(e) => {
            const comment = e.target.value;
            setDraft((d) => ({ ...d, comment }));
          }}
          rows={2}
          placeholder="Anything unclear or worth noting? Write it here."
          className="mt-1 w-full resize-y border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-text-tertiary focus:border-text-tertiary"
        />
      </label>

      {error ? (
        <p className="text-sm text-danger">
          Could not save: {error instanceof ApiError ? error.message : String(error)}. Please try again.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onSave} disabled={!canSave} className={PRIMARY}>
          {saving ? "Saving…" : isChange ? "Save the change" : "Save and continue"}
          {!saving && <ArrowRight className="size-4" />}
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className={SECONDARY}>
            Skip for now
          </button>
        )}
        {onPrevious && (
          <button type="button" onClick={onPrevious} className="ml-auto inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-foreground">
            <ArrowLeft className="size-4" /> Previous article
          </button>
        )}
      </div>
      {!draft.verdict && (
        <p className="text-xs text-text-tertiary">Choose an answer to continue.</p>
      )}
    </section>
  );
}

function SavedCard({
  query,
  monthly,
  mine,
  reveal,
  betterFit,
  onNext,
  onChange,
  onPrevious,
}: {
  query: ReviewQuery;
  monthly: boolean;
  mine: ReviewLabel;
  reveal: ReviewReveal;
  betterFit: ReviewQuery | null;
  onNext: () => void;
  onChange: () => void;
  onPrevious: (() => void) | null;
}) {
  const ref = reveal.reference;
  const included = systemIncluded(ref.system_put_it_in, query.number, monthly);
  const auditor = ref.auditor?.[queryKey(query.number)] as VerdictValue | undefined;
  const auditorSub = ref.auditor_subtopic?.[queryKey(query.number)];
  const others = reveal.others.filter((o) => o.topic_id === mine.topic_id);
  const judge = judgeLabel(ref.judge?.verdict);

  return (
    <section className="space-y-4 border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-success/20 text-success">
          <Check className="size-4" />
        </span>
        <div>
          <h3 className="text-base font-medium text-foreground">Saved</h3>
          <p className="text-sm text-text-secondary">
            Your answer: <strong className="font-medium text-foreground">{VERDICT_CHOICE[mine.verdict]}</strong>
            {mine.subtopic ? ` — ${query.subtopics[mine.subtopic - 1]}` : ""}
          </p>
          {betterFit && (
            <p className="mt-1 text-sm text-text-secondary">
              Fits better: <strong className="font-medium text-foreground">Query {betterFit.number}</strong> — {betterFit.title}
            </p>
          )}
          {mine.comment && <p className="mt-1 text-sm text-text-tertiary">“{mine.comment}”</p>}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4 text-sm">
        <p className="text-xs text-text-tertiary">For comparison</p>
        {included !== null && (
          <Compare
            who="The system"
            text={included ? "put it in this query" : "did not put it in this query"}
            agrees={(mine.verdict !== "no") === included}
          />
        )}
        {auditor && (
          <Compare
            who="AI reviewer"
            text={`${VERDICT_CHOICE[auditor] ?? auditor}${auditorSub ? ` — ${auditorSub}` : ""}`}
            agrees={auditor === mine.verdict}
          />
        )}
        {judge && (
          <Compare
            who="AI judge"
            text={VERDICT_CHOICE[judge]}
            agrees={judge === mine.verdict}
          />
        )}
        {others.map((o) => (
          <Compare
            key={o.editor}
            who={o.editor}
            text={`${VERDICT_CHOICE[o.verdict]}${o.comment ? ` — “${o.comment}”` : ""}`}
            agrees={o.verdict === mine.verdict}
          />
        ))}
        <p className="pt-1 text-xs text-text-tertiary">
          The system and the AI are often wrong. If you disagree, keep your answer;
          that is exactly what we need to find.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onNext} className={PRIMARY} autoFocus>
          Next article <ArrowRight className="size-4" />
        </button>
        <button type="button" onClick={onChange} className={SECONDARY}>
          Change my answer
        </button>
        {onPrevious && (
          <button type="button" onClick={onPrevious} className="ml-auto inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-foreground">
            <ArrowLeft className="size-4" /> Previous article
          </button>
        )}
      </div>
    </section>
  );
}

function Compare({ who, text, agrees }: { who: string; text: string; agrees: boolean }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-text-tertiary">{who}:</span>
      <span className="text-text-secondary">{text}</span>
      <span className={cn("text-xs", agrees ? "text-success" : "text-warning")}>
        {agrees ? "same as you" : "different from you"}
      </span>
    </p>
  );
}

function QueryGuide({ query }: { query: ReviewQuery }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <section className="border border-border bg-card p-4">
        <KickerLabel>What this query covers</KickerLabel>
        <h3 className="mt-2 text-sm font-medium text-foreground">{query.title}</h3>
        <ol className="mt-3 space-y-1.5 text-sm text-text-secondary">
          {query.subtopics.map((s, i) => (
            <li key={s} className="flex gap-2">
              <span className="text-text-tertiary">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {query.basic_keywords && (
          <details className="mt-3 text-xs text-text-tertiary">
            <summary className="cursor-pointer hover:text-foreground">Typical words</summary>
            <p className="mt-2 leading-relaxed">
              {query.basic_keywords}
              {query.detailed_keywords ? `, ${query.detailed_keywords}` : ""}
            </p>
          </details>
        )}
      </section>
      <section className="border border-border bg-card p-4 text-sm text-text-secondary">
        <KickerLabel>How to decide</KickerLabel>
        <ul className="mt-2 space-y-1.5">
          <li><strong className="font-medium text-foreground">Yes</strong> — the article is mainly about one of the topics above.</li>
          <li><strong className="font-medium text-foreground">Borderline</strong> — it touches the query, but it is not the main subject.</li>
          <li><strong className="font-medium text-foreground">No</strong> — it is about something else.</li>
        </ul>
        <p className="mt-2 text-xs text-text-tertiary">
          Not sure? Choose Borderline and add a comment. Unclear cases are useful too.
        </p>
      </section>
      <details className="border border-border bg-card p-4 text-xs text-text-tertiary">
        <summary className="cursor-pointer hover:text-foreground">Keyboard shortcuts (optional)</summary>
        <ul className="mt-2 space-y-1">
          <li><Key>Y</Key> Yes · <Key>B</Key> Borderline · <Key>N</Key> No</li>
          <li><Key>1</Key>–<Key>5</Key> choose a topic</li>
          <li><Key>Enter</Key> save, then next article</li>
          <li><Key>S</Key> skip · <Key>O</Key> open the article</li>
        </ul>
      </details>
    </aside>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="border border-strong px-1 font-mono text-[11px] text-text-secondary">{children}</kbd>;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
