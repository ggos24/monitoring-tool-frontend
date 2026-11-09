"use client";

import { useState } from "react";

import { formatTerm, moreLabel, PREVIEW_COUNT, previewList } from "@/lib/narrative-rules";

// A few example terms with "show all" to expand. Terms are shown exactly
// as the rules have them, except a trailing * which reads as "…".
export function TermList({
  terms,
  quoted = false,
  limit = PREVIEW_COUNT,
}: {
  terms: string[];
  quoted?: boolean;
  limit?: number;
}) {
  const [all, setAll] = useState(false);
  if (terms.length === 0) return null;

  const { shown, hidden } = previewList(terms, limit);
  const list = all ? terms : shown;
  const fmt = (t: string) => (quoted ? `“${formatTerm(t)}”` : formatTerm(t));

  return (
    <span className="text-text-secondary">
      {hidden > 0 && !all ? "e.g. " : ""}
      <span className="font-mono text-[11px]">{list.map(fmt).join(", ")}</span>
      {hidden > 0 && (
        <>
          {!all && (
            <span className="font-mono text-[11px] text-text-tertiary"> {moreLabel(hidden)} ·</span>
          )}{" "}
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            aria-expanded={all}
            className="cursor-pointer font-mono text-[11px] text-text-tertiary underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            {all ? "show fewer" : "show all"}
          </button>
        </>
      )}
    </span>
  );
}
