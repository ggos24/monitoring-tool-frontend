"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EditorBadge, EditorGate, useEditorName } from "@/components/review/editor-gate";
import { Button } from "@/components/ui/button";
import { KickerLabel } from "@/components/ui/kicker-label";
import { ApiError, apiClient } from "@/lib/api";
import { MAX_COMMENT } from "@/lib/review";
import type { BoundaryAnswerValue, BoundaryQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

const ANSWER_LABEL: Record<BoundaryAnswerValue, string> = {
  yes: "Yes, include it",
  no: "No, leave it out",
  unsure: "Not sure",
};

export function BoundaryPanel() {
  const [editor, setEditor, ready] = useEditorName();
  if (!ready) return null;
  if (!editor) return <EditorGate onSubmit={setEditor} />;
  return <Questions editor={editor} onChangeEditor={() => setEditor(null)} />;
}

function Questions({ editor, onChangeEditor }: { editor: string; onChangeEditor: () => void }) {
  const questionsQ = useQuery({
    queryKey: ["boundary-questions", editor],
    queryFn: () => apiClient.boundaryQuestions(editor),
  });
  const queriesQ = useQuery({ queryKey: ["review-queries"], queryFn: apiClient.reviewQueries });
  const titles = new Map((queriesQ.data?.queries ?? []).map((q) => [q.number, q.title]));
  const questions = questionsQ.data ?? [];
  const answered = questions.filter((q) => q.mine).length;
  const byQuery = [1, 2, 3].map((n) => ({ n, items: questions.filter((q) => q.query_number === n) }));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <EditorBadge name={editor} onChange={onChangeEditor} />
      </div>
      <section className="border border-border bg-card p-5">
        <h2 className="text-base font-medium text-foreground">Where does each query end?</h2>
        <p className="mt-1 text-sm text-text-secondary">
          These are kinds of articles we were not sure about. Your answer becomes the
          rule for every similar article, so it matters more than a single label.
          Answer what you can; you can change an answer later.
        </p>
        <div className="mt-4 space-y-1.5">
          <p className="text-sm text-text-tertiary">
            {answered} of {questions.length} answered
          </p>
          <div className="h-1.5 w-full bg-elevated">
            <div
              className="h-1.5 bg-success transition-all"
              style={{ width: `${questions.length ? Math.round((answered / questions.length) * 100) : 0}%` }}
            />
          </div>
        </div>
      </section>
      {questionsQ.error && <p className="text-xs text-danger">{String(questionsQ.error)}</p>}
      {byQuery.map(({ n, items }) =>
        items.length === 0 ? null : (
          <section key={n} className="space-y-3">
            <div>
              <KickerLabel>Query {n}</KickerLabel>
              {titles.get(n) && <h3 className="mt-1 text-base text-foreground">{titles.get(n)}</h3>}
            </div>
            {items.map((q) => (
              <QuestionCard key={q.id} question={q} editor={editor} />
            ))}
          </section>
        ),
      )}
    </div>
  );
}

function QuestionCard({ question, editor }: { question: BoundaryQuestion; editor: string }) {
  const qc = useQueryClient();
  const [answer, setAnswer] = useState<BoundaryAnswerValue | null>(question.mine?.answer ?? null);
  const [comment, setComment] = useState(question.mine?.comment ?? "");
  const dirty =
    answer !== (question.mine?.answer ?? null) || comment.trim() !== (question.mine?.comment ?? "");

  const save = useMutation({
    mutationFn: () =>
      apiClient.saveBoundaryAnswer(question.id, {
        editor,
        answer: answer as BoundaryAnswerValue,
        comment: comment.trim() || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boundary-questions"] }),
  });

  return (
    <article className="border border-border bg-card p-4">
      <p className="text-sm text-foreground">
        <span className="mr-2 text-text-tertiary">{question.number}.</span>
        {question.question}
      </p>
      {question.example_headline && (
        <p className="mt-2 text-xs text-text-secondary">
          Example headline: <span className="italic">&ldquo;{question.example_headline}&rdquo;</span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {(["yes", "no", "unsure"] as BoundaryAnswerValue[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAnswer(a)}
            className={cn(
              "h-9 border px-3 text-sm transition-colors",
              answer === a
                ? "border-text-secondary bg-elevated text-foreground"
                : "border-strong text-text-tertiary hover:text-foreground",
            )}
          >
            {ANSWER_LABEL[a]}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        maxLength={MAX_COMMENT}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Why? Where exactly is the line? (optional)"
        className="mt-3 w-full resize-y border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-text-tertiary focus:border-text-tertiary"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" onClick={() => save.mutate()} disabled={!answer || !dirty || save.isPending}>
          {save.isPending ? "Saving…" : question.mine ? "Update answer" : "Save answer"}
        </Button>
        {question.mine && !dirty && <span className="text-sm text-success">Saved</span>}
        {save.error && (
          <span className="text-xs text-danger">
            {save.error instanceof ApiError ? save.error.message : String(save.error)}
          </span>
        )}
      </div>
      {question.others && question.others.length > 0 && (
        <ul className="mt-3 space-y-0.5 border-t border-border pt-2 text-sm text-text-secondary">
          <li className="text-xs text-text-tertiary">Other editors</li>
          {question.others.map((o) => (
            <li key={o.editor}>
              {o.editor}: {ANSWER_LABEL[o.answer]}
              {o.comment ? ` — ${o.comment}` : ""}
            </li>
          ))}
        </ul>
      )}
      {question.mine && question.others?.length === 0 && (
        <p className="mt-3 text-xs text-text-tertiary">No other editor has answered yet.</p>
      )}
    </article>
  );
}
