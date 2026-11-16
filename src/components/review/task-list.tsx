"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, X } from "lucide-react";

import { KickerLabel } from "@/components/ui/kicker-label";
import { apiClient } from "@/lib/api";
import {
  HOWTO_KEY,
  TASK_BUTTON,
  progressLabel,
  progressPercent,
  taskHref,
  taskState,
} from "@/lib/review";
import type { ReviewBatch, ReviewQuery, ReviewRoundProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

type Task = {
  batch: ReviewBatch;
  query: ReviewQuery;
  first: ReviewRoundProgress;
  more: ReviewRoundProgress | null; // the optional second part of a batch
};

type Section = { title: string; description: string; tasks: Task[] };

/** Start screen: every task (a batch × one query) with its progress. */
export function TaskList({ editor }: { editor: string }) {
  const queriesQ = useQuery({ queryKey: ["review-queries"], queryFn: apiClient.reviewQueries });
  const queries = (queriesQ.data?.queries ?? []).filter((q) => q.topic_id !== null);

  // Progress is per query, so ask once per query.
  const perQuery = useQueries({
    queries: queries.map((q) => ({
      queryKey: ["review-batches", editor, [q.topic_id]],
      queryFn: () => apiClient.reviewBatches(editor, [q.topic_id as number]),
    })),
  });

  const loading = queriesQ.isLoading || perQuery.some((r) => r.isLoading);
  const error = queriesQ.error ?? perQuery.find((r) => r.error)?.error;

  const tasks: Task[] = [];
  queries.forEach((q, i) => {
    for (const batch of perQuery[i]?.data ?? []) {
      if (batch.topic_id !== null && batch.topic_id !== q.topic_id) continue;
      const first = batch.rounds.find((r) => r.round === 1);
      if (!first) continue;
      tasks.push({ batch, query: q, first, more: batch.rounds.find((r) => r.round === 2) ?? null });
    }
  });

  // One section per batch title (the three monthly batches of a month share one).
  const sections: Section[] = [];
  for (const t of tasks) {
    let s = sections.find((x) => x.title === t.batch.title);
    if (!s) {
      s = { title: t.batch.title, description: t.batch.description, tasks: [] };
      sections.push(s);
    }
    s.tasks.push(t);
  }
  // Within a section: Query 1, 2, 3. Sections: unfinished work first, then newest.
  const left = (s: Section) => s.tasks.some((t) => t.first.done < t.first.total);
  const newest = (s: Section) => Math.max(...s.tasks.map((t) => t.batch.id));
  for (const s of sections) s.tasks.sort((a, b) => a.query.number - b.query.number);
  sections.sort((a, b) => Number(left(b)) - Number(left(a)) || newest(b) - newest(a));

  return (
    <div className="space-y-8">
      <HowItWorks />
      {loading && <p className="text-sm text-text-tertiary">Loading your tasks…</p>}
      {error && <p className="text-sm text-danger">Could not load the tasks: {String(error)}</p>}
      {!loading && !error && sections.length === 0 && (
        <p className="text-sm text-text-tertiary">There is nothing to label yet.</p>
      )}
      {sections.map((s) => (
        <section key={s.title} className="space-y-3">
          <div>
            <h2 className="text-base font-medium text-foreground">{s.title}</h2>
            {s.description && <p className="mt-0.5 text-sm text-text-tertiary">{s.description}</p>}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {s.tasks.map((t) => (
              <TaskCard key={`${t.batch.id}-${t.query.number}`} task={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const { batch, query, first, more } = task;
  const state = taskState(first.done, first.total);
  const moreLeft = more && more.done < more.total;
  return (
    <article className="flex flex-col border border-border bg-card p-4">
      <KickerLabel>Query {query.number}</KickerLabel>
      <h3 className="mt-2 flex-1 text-sm leading-snug text-foreground">{query.title}</h3>
      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between text-xs text-text-tertiary">
          <span>
            {progressLabel(first.done, first.total)} articles
          </span>
          {state === "done" && (
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="size-3.5" /> Done
            </span>
          )}
        </div>
        <div className="h-1.5 w-full bg-elevated">
          <div
            className="h-1.5 bg-success transition-all"
            style={{ width: `${progressPercent(first.done, first.total)}%` }}
          />
        </div>
      </div>
      {state !== "done" ? (
        <Link
          href={taskHref(batch.id, query.number, 1)}
          className={cn(
            "mt-4 inline-flex h-10 items-center justify-center gap-2 text-sm font-medium transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/85",
          )}
        >
          {TASK_BUTTON[state]} <ArrowRight className="size-4" />
        </Link>
      ) : moreLeft ? (
        <Link
          href={taskHref(batch.id, query.number, 2)}
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 border border-strong text-sm text-text-secondary transition-colors hover:text-foreground"
        >
          Keep going: {more!.total - more!.done} more <ArrowRight className="size-4" />
        </Link>
      ) : (
        <p className="mt-4 text-center text-xs text-text-tertiary">Thank you — all labelled.</p>
      )}
    </article>
  );
}

function HowItWorks() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(HOWTO_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  const toggle = (value: boolean) => {
    setHidden(value);
    try {
      window.localStorage.setItem(HOWTO_KEY, value ? "1" : "0");
    } catch {
      // storage blocked: remember only for this visit
    }
  };
  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        className="text-sm text-text-tertiary underline-offset-4 hover:text-foreground hover:underline"
      >
        How does this work?
      </button>
    );
  }
  return (
    <section className="relative border border-border bg-card p-5">
      <button
        type="button"
        aria-label="Hide"
        onClick={() => toggle(true)}
        className="absolute right-3 top-3 text-text-tertiary hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <h2 className="text-base font-medium text-foreground">How this works</h2>
      <ol className="mt-3 grid gap-4 text-sm text-text-secondary md:grid-cols-3">
        <li>
          <span className="block font-medium text-foreground">1. Pick a task</span>
          Each task is one query and a list of articles. You can share the tasks
          with colleagues: everyone labels on their own.
        </li>
        <li>
          <span className="block font-medium text-foreground">2. Answer one question</span>
          For each article: is it about this query? Choose Yes, Borderline or No.
          If you are not sure, open the article and read it.
        </li>
        <li>
          <span className="block font-medium text-foreground">3. Stop any time</span>
          Every answer is saved at once. Come back later and you continue where
          you stopped.
        </li>
      </ol>
      <p className="mt-4 text-xs text-text-tertiary">
        After you answer, you see what the system and an AI reviewer decided. They
        are often wrong. That is why we need your answer, so trust your own judgement.
      </p>
    </section>
  );
}
