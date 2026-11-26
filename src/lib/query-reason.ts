// Why an article is in a query, in words an editor reads (article hover card).
// Input = that query's row verdict from /api/mentions `query_reasons`
// (backend `mention.relevance_method` / `relevance_reason`). The raw rule text
// is always shown too, so an unknown format is never hidden.

export type ReasonExplanation = {
  /** Who decided: words, AI judge, collection axis, editor. */
  source: string;
  /** What exactly matched / what the judge said. */
  detail: string;
};

const AXIS_TEXT: Record<string, string> = {
  U: "mentions United24 / United24Media",
  A: "mentions Ukraine",
  B: "harvest axis B",
};

function axesText(axes: string): string {
  return axes
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((a) => AXIS_TEXT[a] ?? `axis ${a}`)
    .join(", ");
}

function quoted(reason: string, re: RegExp): string | null {
  const m = reason.match(re);
  return m ? m[1] : null;
}

export function explainQueryReason(
  method: string | null,
  reason: string | null,
): ReasonExplanation {
  const r = (reason ?? "").trim();
  switch (method) {
    case "axis": {
      const axes = quoted(r, /axis(?:es)?\s+([A-Z][A-Z,\s]*?)(?:\s+in\s+accept_axes)?$/);
      return {
        source: "Collection rule",
        detail: axes
          ? `Found by this query's own search (${axesText(axes)}); added without a word check.`
          : "Found by this query's own search; added without a word check.",
      };
    }
    case "lexical": {
      const phrase = quoted(r, /matched (?:phrase|core term) '([^']+)'/);
      return {
        source: "Word rules",
        detail: phrase ? `Key phrase “${phrase}” is in the headline.` : r || "A key phrase matched.",
      };
    }
    case "killswitch": {
      if (r.includes("no anchors defined")) {
        return {
          source: "Word rules",
          detail: "Accepted without a word check (this query has no word groups).",
        };
      }
      const words = quoted(r, /anchor accept:\s*(.+)$/);
      return {
        source: "Word rules",
        detail: words
          ? `Every word group matched in the headline: ${words}.`
          : r || "The word groups matched.",
      };
    }
    case "ai_judge": {
      const sub = quoted(r, /subtopic\s+(.+)$/);
      return {
        source: "AI judge",
        detail: sub
          ? `The AI judge read the headline and lede and said yes — subtopic ${sub}.`
          : "The AI judge read the headline and lede and said yes.",
      };
    }
    case "pending_batch":
      return {
        source: "Word rules (provisional)",
        detail: "Shown for now; the nightly AI check decides whether it stays.",
      };
    case "llm_batch":
    case "llm":
      return { source: "Nightly AI check", detail: r.replace(/^.*LLM:\s*/, "") || "Accepted." };
    case "cosine":
      return { source: "Meaning similarity", detail: "Close in meaning to the query description." };
    case "editor":
      return { source: "Editor", detail: r || "Changed by an editor." };
    case null:
    case undefined:
      return { source: "Unknown", detail: "Added before decisions were recorded." };
    default:
      return { source: method, detail: r || "—" };
  }
}

export const CORRECTION_REASONS = [
  { code: "off_topic", label: "Not about this query" },
  { code: "not_ukraine", label: "Not about Ukraine" },
  { code: "duplicate", label: "Duplicate" },
  { code: "other", label: "Other" },
] as const;

export const MOVE_REASON = { code: "better_fit", label: "Fits another query better" } as const;
