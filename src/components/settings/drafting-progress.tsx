"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "Drafting with Gemini…",
  "Discovering terms via DataForSEO…",
  "Validating search volumes…",
  "Composing AST…",
  "Embedding semantic anchor…",
];

// Honest indicator: backend returns one final response after ~10s, so we
// can't truly observe each stage. The cycling labels give the operator a
// sense of "something is happening" matching the real pipeline order.
export function DraftingProgress({ phrase }: { phrase: string }) {
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const stageTimer = setInterval(() => {
      setStageIdx((i) => (i + 1) % STAGES.length);
    }, 2500);
    const tickTimer = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => {
      clearInterval(stageTimer);
      clearInterval(tickTimer);
    };
  }, []);

  const overdue =
    elapsed > 30
      ? "Still working — this can take up to a minute."
      : null;

  return (
    <div className="border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        Building topic for &ldquo;{phrase}&rdquo;
      </p>
      <p className="mt-3 font-mono text-sm text-foreground">
        <span className="mr-2 inline-block size-2 animate-pulse bg-emerald-400" />
        {STAGES[stageIdx]}
      </p>
      <p className="mt-2 font-mono text-[11px] text-text-tertiary">
        Expected ~10 seconds. Cost ~$0.10.
      </p>
      {overdue && (
        <p className="mt-3 font-mono text-[11px] text-amber-500">{overdue}</p>
      )}
      <p className="mt-3 font-mono text-[10px] text-muted-foreground">
        Elapsed: {elapsed}s
      </p>
    </div>
  );
}
