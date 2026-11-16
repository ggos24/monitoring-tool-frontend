"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { EditorBadge, EditorGate, useEditorName } from "@/components/review/editor-gate";
import { Button } from "@/components/ui/button";
import { KickerLabel } from "@/components/ui/kicker-label";
import { ApiError, apiClient } from "@/lib/api";
import {
  EMPTY_DRAFT,
  MAX_COMMENT,
  VERDICT_LABEL,
  agreement,
  applySubtopic,
  applyVerdict,
  canSave,
  isTypingTarget,
  keyToAction,
  progressLabel,
  progressPercent,
  queryKey,
  type Draft,
  type VerdictValue,
} from "@/lib/review";
import type { ReviewBatch, ReviewItem, ReviewQuery, ReviewSaved } from "@/lib/types";
import { cn } from "@/lib/utils";

type Scope = "all" | number; // "all" = all three queries, else query number

const SELECT =
  "h-9 border border-strong bg-card px-2 font-mono text-xs text-text-secondary outline-none hover:border-text-tertiary";

export function ReviewPanel() {
  const [editor, setEditor, ready] = useEditorName();
  if (!ready) return null;
  if (!editor) return <EditorGate onSubmit={setEditor} />;
  return <Labeller editor={editor} onChangeEditor={() => setEditor(null)} />;
}

function Labeller({ editor, onChangeEditor }: { editor: string; onChangeEditor: () => void }) {
  const qc = useQueryClient();
  const queriesQ = useQuery({ queryKey: ["review-queries"], queryFn: apiClient.reviewQueries });
  const queries = useMemo(
    () => (queriesQ.data?.queries ?? []).filter((q) => q.topic_id !== null),
    [queriesQ.data],
  );

  const [scope, setScope] = useState<Scope>("all");
  const scopeTopics = useMemo(
    () =>
      queries
        .filter((q) => scope === "all" || q.number === scope)
        .map((q) => q.topic_id as number),
    [queries, scope],
  );

  const batchesQ = useQuery({
    queryKey: ["review-batches", editor, scopeTopics],
    queryFn: () => apiClient.reviewBatches(editor, scopeTopics),
    enabled: scopeTopics.length > 0,
  });
  const [batchId, setBatchId] = useState<number | null>(null);
  const batch: ReviewBatch | undefined =
    batchesQ.data?.find((b) => b.id === batchId) ?? batchesQ.data?.[0];
  // A monthly batch is labelled for its own query only.
  const topics = batch?.topic_ids ?? scopeTopics;
  const cardQueries = queries.filter((q) => topics.includes(q.topic_id as number));

  const [round, setRound] = useState(1);
  const [after, setAfter] = useState(-1);
  useEffect(() => {
    setRound(1);
    setAfter(-1);
  }, [batch?.id, scope]);

  const nextKey = ["review-next", batch?.id, editor, topics, round, after];
  const nextQ = useQuery({
    queryKey: nextKey,
    queryFn: () => apiClient.reviewNext(batch!.id, { editor, topics, round, after }),
    enabled: !!batch && topics.length > 0,
    staleTime: Infinity,
  });

  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState<{ item: ReviewItem; result: ReviewSaved } | null>(null);
  const item = saved?.item ?? nextQ.data?.item ?? null;

  // fresh card → empty drafts
  useEffect(() => {
    setDrafts({});
    setActive(0);
  }, [item?.id]);

  const save = useMutation({
    mutationFn: () =>
      apiClient.saveReviewLabels(
        item!.id,
        editor,
        cardQueries.map((q) => {
          const d = drafts[q.topic_id as number] ?? EMPTY_DRAFT;
          return {
            topic_id: q.topic_id as number,
            verdict: d.verdict as VerdictValue,
            subtopic: d.verdict === "no" ? null : d.subtopic,
            comment: d.comment.trim() || null,
          };
        }),
      ),
    onSuccess: (result) => {
      if (item) setSaved({ item, result });
      qc.invalidateQueries({ queryKey: ["review-batches"] });
    },
  });

  const goNext = useCallback(() => {
    setSaved(null);
    setDrafts({});
    setActive(0);
    setAfter(-1);
    qc.invalidateQueries({ queryKey: ["review-next"] });
  }, [qc]);

  const skip = useCallback(() => {
    if (item && !saved) setAfter(item.position);
  }, [item, saved]);

  const updateDraft = useCallback(
    (topicId: number, fn: (d: Draft) => Draft) =>
      setDrafts((prev) => ({ ...prev, [topicId]: fn(prev[topicId] ?? EMPTY_DRAFT) })),
    [],
  );

  const ready = item !== null && canSave(drafts, topics);

  // keyboard
  const stateRef = useRef({ saved, ready, item, cardQueries, active });
  stateRef.current = { saved, ready, item, cardQueries, active };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target as HTMLElement)) return;
      const action = keyToAction(e.key);
      if (!action) return;
      const s = stateRef.current;
      if (!s.item) return;
      const row = s.cardQueries[s.active];
      if (action.type === "open") {
        window.open(s.item.url, "_blank", "noopener,noreferrer");
      } else if (action.type === "save") {
        if (s.saved) goNext();
        else if (s.ready && !save.isPending) save.mutate();
      } else if (s.saved) {
        return; // after saving, only Enter (next) and O (open) act
      } else if (action.type === "skip") {
        skip();
      } else if (action.type === "row") {
        setActive((i) => Math.max(0, Math.min(s.cardQueries.length - 1, i + action.delta)));
      } else if (row && action.type === "verdict") {
        updateDraft(row.topic_id as number, (d) => applyVerdict(d, action.verdict));
        if (s.cardQueries.length > 1 && s.active < s.cardQueries.length - 1) {
          setActive(s.active + 1);
        }
      } else if (row && action.type === "subtopic") {
        if (action.subtopic <= row.subtopics.length) {
          updateDraft(row.topic_id as number, (d) => applySubtopic(d, action.subtopic));
        }
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, save, skip, updateDraft]);

  const roundInfo = batch?.rounds.find((r) => r.round === round);
  const otherRounds = (batch?.rounds ?? []).filter((r) => r.round !== round);

  return (
    <div className="space-y-5">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-mono text-xs text-text-tertiary">
          Query
          <select
            className={SELECT}
            value={scope === "all" ? "all" : String(scope)}
            onChange={(e) => setScope(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">All three queries</option>
            {queries.map((q) => (
              <option key={q.number} value={q.number}>
                Query {q.number}: {q.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-mono text-xs text-text-tertiary">
          Batch
          <select
            className={SELECT}
            value={batch?.id ?? ""}
            onChange={(e) => setBatchId(Number(e.target.value))}
          >
            {(batchesQ.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {otherRounds.length > 0 && (
          <label className="flex items-center gap-2 font-mono text-xs text-text-tertiary">
            Part
            <select className={SELECT} value={round} onChange={(e) => setRound(Number(e.target.value))}>
              {(batch?.rounds ?? []).map((r) => (
                <option key={r.round} value={r.round}>
                  {r.round === 1 ? "First" : `Next ${r.total}`} ({progressLabel(r.done, r.total)})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto">
          <EditorBadge name={editor} onChange={onChangeEditor} />
        </div>
      </div>

      {roundInfo && (
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-xs text-text-tertiary">
            <span>
              Labelled <span className="text-foreground">{progressLabel(roundInfo.done, roundInfo.total)}</span>
            </span>
            <span>Y / B / N verdict · 1–5 subtopic · ↑↓ query · Enter save / next · S skip · O open</span>
          </div>
          <div className="h-1 w-full bg-elevated">
            <div
              className="h-1 bg-success transition-all"
              style={{ width: `${progressPercent(roundInfo.done, roundInfo.total)}%` }}
            />
          </div>
        </div>
      )}

      {queriesQ.error || batchesQ.error || nextQ.error ? (
        <p className="text-xs text-danger">
          {String((queriesQ.error ?? batchesQ.error ?? nextQ.error) as Error)}
        </p>
      ) : null}
      {batchesQ.data && batchesQ.data.length === 0 && (
        <p className="text-xs text-text-tertiary">No batches to label yet.</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <QueryDescriptions queries={cardQueries} activeTopic={cardQueries[active]?.topic_id ?? null} />

        <div className="space-y-4">
          {nextQ.isLoading && <p className="text-xs text-text-tertiary">Loading…</p>}
          {!nextQ.isLoading && !item && batch && (
            <section className="border border-border bg-card p-5 text-sm">
              All articles in this part are labelled for the chosen queries.
              {otherRounds.some((r) => r.done < r.total) && " Pick the next part above to continue."}
            </section>
          )}
          {item && (
            <>
              <ArticleCard item={item} />
              {cardQueries.map((q, i) => (
                <VerdictRow
                  key={q.number}
                  query={q}
                  draft={drafts[q.topic_id as number] ?? EMPTY_DRAFT}
                  active={i === active}
                  locked={!!saved}
                  onFocus={() => setActive(i)}
                  onChange={(fn) => updateDraft(q.topic_id as number, fn)}
                />
              ))}
              {save.error && (
                <p className="text-xs text-danger">
                  {save.error instanceof ApiError ? save.error.message : String(save.error)}
                </p>
              )}
              {!saved ? (
                <div className="flex gap-2">
                  <Button onClick={() => save.mutate()} disabled={!ready || save.isPending}>
                    {save.isPending ? "Saving…" : "Save  ⏎"}
                  </Button>
                  <Button variant="outline" onClick={skip}>
                    Skip (S)
                  </Button>
                </div>
              ) : (
                <>
                  <Reveal queries={cardQueries} result={saved.result} />
                  <Button onClick={goNext}>Next article ⏎</Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QueryDescriptions({ queries, activeTopic }: { queries: ReviewQuery[]; activeTopic: number | null }) {
  return (
    <aside className="space-y-4">
      {queries.map((q) => (
        <section
          key={q.number}
          className={cn(
            "border bg-card p-4",
            q.topic_id === activeTopic && queries.length > 1 ? "border-text-tertiary" : "border-border",
          )}
        >
          <KickerLabel>Query {q.number}</KickerLabel>
          <h3 className="mt-2 text-sm font-medium text-foreground">{q.title}</h3>
          <ol className="mt-3 space-y-1 text-xs text-text-secondary">
            {q.subtopics.map((s, i) => (
              <li key={s} className="flex gap-2">
                <span className="font-mono text-text-tertiary">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {q.basic_keywords && (
            <p className="mt-3 text-[11px] leading-relaxed text-text-tertiary">
              Keywords: {q.basic_keywords}
            </p>
          )}
        </section>
      ))}
      <p className="text-[11px] leading-relaxed text-text-tertiary">
        Yes — the article is about the query. Border — partly, or only as a side
        point. No — not about the query. The subtopic is optional.
      </p>
    </aside>
  );
}

function ArticleCard({ item }: { item: ReviewItem }) {
  return (
    <section className="border border-border bg-card p-5">
      <div className="flex items-center gap-3 font-mono text-xs text-text-tertiary">
        <span className="text-text-secondary">{item.outlet ?? "unknown outlet"}</span>
        {item.published_date && <span>{item.published_date}</span>}
      </div>
      <h2 className="mt-2 text-lg leading-snug text-foreground">{item.headline}</h2>
      {item.opening ? (
        <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-text-secondary">
          {item.opening}
        </p>
      ) : (
        <p className="mt-3 text-xs text-text-tertiary">
          We store only the headline for this article. Open it to read the text.
        </p>
      )}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs text-text-secondary underline-offset-4 hover:text-foreground hover:underline"
      >
        Open article on the outlet&apos;s site (O) <ExternalLink className="size-3" />
      </a>
    </section>
  );
}

function VerdictRow({
  query,
  draft,
  active,
  locked,
  onFocus,
  onChange,
}: {
  query: ReviewQuery;
  draft: Draft;
  active: boolean;
  locked: boolean;
  onFocus: () => void;
  onChange: (fn: (d: Draft) => Draft) => void;
}) {
  return (
    <section
      onClick={onFocus}
      className={cn(
        "border bg-card p-4",
        active && !locked ? "border-text-tertiary" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-20 font-mono text-xs text-text-secondary">Query {query.number}</span>
        <div className="flex gap-1">
          {(["yes", "border", "no"] as VerdictValue[]).map((v) => (
            <button
              key={v}
              type="button"
              disabled={locked}
              onClick={() => onChange((d) => applyVerdict(d, v))}
              className={cn(
                "h-8 min-w-16 border px-3 font-mono text-xs transition-colors disabled:cursor-default",
                draft.verdict === v
                  ? v === "yes"
                    ? "border-success bg-success/20 text-foreground"
                    : v === "border"
                      ? "border-warning bg-warning/20 text-foreground"
                      : "border-danger bg-danger/20 text-foreground"
                  : "border-strong text-text-tertiary hover:text-foreground",
              )}
            >
              {VERDICT_LABEL[v]} <span className="text-text-tertiary">{v[0].toUpperCase()}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1" aria-label="Subtopic">
          {query.subtopics.map((s, i) => (
            <button
              key={s}
              type="button"
              title={s}
              disabled={locked || draft.verdict === "no"}
              onClick={() => onChange((d) => applySubtopic(d, i + 1))}
              className={cn(
                "size-8 border font-mono text-xs transition-colors disabled:opacity-30",
                draft.subtopic === i + 1
                  ? "border-text-secondary bg-elevated text-foreground"
                  : "border-strong text-text-tertiary hover:text-foreground",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      {draft.subtopic && (
        <p className="mt-2 text-xs text-text-secondary">
          Subtopic {draft.subtopic}: {query.subtopics[draft.subtopic - 1]}
        </p>
      )}
      <textarea
        value={draft.comment}
        disabled={locked}
        maxLength={MAX_COMMENT}
        onFocus={onFocus}
        onChange={(e) => {
          const comment = e.target.value;
          onChange((d) => ({ ...d, comment }));
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
        }}
        rows={1}
        placeholder="Comment (optional, Esc to leave the field)"
        className="mt-3 w-full resize-y border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-text-tertiary focus:border-text-tertiary"
      />
    </section>
  );
}

function Reveal({ queries, result }: { queries: ReviewQuery[]; result: ReviewSaved }) {
  const ref = result.reveal.reference;
  const mine = new Map(result.mine.map((l) => [l.topic_id, l]));
  const isAudit = !!ref.auditor;
  return (
    <section className="space-y-3 border border-border bg-elevated p-4">
      <KickerLabel>Saved — what others decided</KickerLabel>
      {ref.system_put_it_in !== undefined && (
        <p className="text-xs text-text-secondary">
          The system put it in:{" "}
          <span className="text-foreground">
            {isAudit ? ref.system_put_it_in || "no query" : ref.system_put_it_in === "yes" ? "this query" : "not in this query"}
          </span>
          {ref.method ? ` (${ref.method}${ref.reason ? `: ${ref.reason}` : ""})` : ""}
        </p>
      )}
      {isAudit && (
        <table className="w-full text-left text-xs">
          <thead className="font-mono text-text-tertiary">
            <tr>
              <th className="py-1 font-normal">Query</th>
              <th className="py-1 font-normal">You</th>
              <th className="py-1 font-normal">AI auditor</th>
              <th className="py-1 font-normal">Auditor subtopic</th>
            </tr>
          </thead>
          <tbody>
            {queries.map((q) => {
              const my = mine.get(q.topic_id as number);
              const theirs = ref.auditor?.[queryKey(q.number)];
              const agree = my ? agreement(my.verdict, theirs) : null;
              return (
                <tr key={q.number} className="border-t border-border">
                  <td className="py-1.5 font-mono">{q.number}</td>
                  <td className="py-1.5">{my ? VERDICT_LABEL[my.verdict] : "—"}</td>
                  <td className={cn("py-1.5", agree === "differ" && "text-warning")}>
                    {theirs ? VERDICT_LABEL[theirs as VerdictValue] ?? theirs : "—"}
                    {agree === "differ" && " · differs"}
                  </td>
                  <td className="py-1.5 text-text-tertiary">{ref.auditor_subtopic?.[queryKey(q.number)] || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {ref.auditor_note && <p className="text-xs text-text-tertiary">Auditor note: {ref.auditor_note}</p>}
      {ref.judge?.verdict && (
        <p className="text-xs text-text-secondary">
          AI judge ({ref.judge.model}): {ref.judge.verdict.belongs ? "belongs" : "does not belong"}
          {ref.judge.verdict.reason ? ` — ${ref.judge.verdict.reason}` : ""}
        </p>
      )}
      {result.reveal.others.length > 0 && (
        <div className="text-xs text-text-secondary">
          <p className="font-mono text-text-tertiary">Other editors</p>
          <ul className="mt-1 space-y-0.5">
            {result.reveal.others.map((l) => {
              const q = queries.find((x) => x.topic_id === l.topic_id);
              return (
                <li key={`${l.editor}-${l.topic_id}`}>
                  {l.editor} · query {q?.number ?? l.topic_id}: {VERDICT_LABEL[l.verdict]}
                  {l.subtopic ? ` (subtopic ${l.subtopic})` : ""}
                  {l.comment ? ` — ${l.comment}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {ref.source && <p className="text-[11px] text-text-tertiary">Source: {ref.source}</p>}
    </section>
  );
}
