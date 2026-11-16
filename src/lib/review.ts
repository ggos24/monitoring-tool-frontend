// Pure helpers for the Review page (editors label articles per query).
// Kept free of React so `npm test` can run them with Node's type stripping.

export type VerdictValue = "yes" | "border" | "no";

export type Draft = {
  verdict: VerdictValue | null;
  subtopic: number | null;
  comment: string;
  /** Topic id of another query the article fits better (only with No / Borderline). */
  betterFit?: number | null;
};

export const EMPTY_DRAFT: Draft = { verdict: null, subtopic: null, comment: "", betterFit: null };

export const VERDICT_LABEL: Record<VerdictValue, string> = {
  yes: "Yes",
  border: "Border",
  no: "No",
};

export const EDITOR_KEY = "u24-review-editor";
export const MAX_COMMENT = 1000;

export type KeyAction =
  | { type: "verdict"; verdict: VerdictValue }
  | { type: "subtopic"; subtopic: number }
  | { type: "row"; delta: 1 | -1 }
  | { type: "save" }
  | { type: "skip" }
  | { type: "open" };

/** Keyboard map. Returns null for keys the page ignores. */
export function keyToAction(key: string): KeyAction | null {
  switch (key.toLowerCase()) {
    case "y":
      return { type: "verdict", verdict: "yes" };
    case "b":
      return { type: "verdict", verdict: "border" };
    case "n":
      return { type: "verdict", verdict: "no" };
    case "arrowdown":
    case "j":
      return { type: "row", delta: 1 };
    case "arrowup":
    case "k":
      return { type: "row", delta: -1 };
    case "enter":
      return { type: "save" };
    case "s":
      return { type: "skip" };
    case "o":
      return { type: "open" };
  }
  if (/^[1-5]$/.test(key)) return { type: "subtopic", subtopic: Number(key) };
  return null;
}

/** Ignore shortcuts while the editor is typing in a field. */
export function isTypingTarget(target: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!target) return false;
  const tag = (target.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!target.isContentEditable;
}

/** A save needs a verdict for every query on the card. */
export function canSave(drafts: Record<number, Draft>, topicIds: number[]): boolean {
  return topicIds.length > 0 && topicIds.every((id) => drafts[id]?.verdict != null);
}

/** Choosing "no" clears the subtopic: a subtopic only describes a yes/border. */
export function applyVerdict(draft: Draft, verdict: VerdictValue): Draft {
  return {
    ...draft,
    verdict,
    subtopic: verdict === "no" ? null : draft.subtopic,
    betterFit: verdict === "yes" ? null : (draft.betterFit ?? null),
  };
}

/** Pressing the same subtopic again clears it. */
export function applySubtopic(draft: Draft, subtopic: number): Draft {
  return { ...draft, subtopic: draft.subtopic === subtopic ? null : subtopic };
}

export function progressLabel(done: number, total: number): string {
  return `${done} of ${total}`;
}

export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

/** Editor names: trimmed, single spaces, 1–64 characters. */
export function cleanEditorName(name: string): string | null {
  const cleaned = name.split(/\s+/).filter(Boolean).join(" ");
  return cleaned.length >= 1 && cleaned.length <= 64 ? cleaned : null;
}

/** "q2" style key for a query number, as used in the auditor's labels. */
export function queryKey(number: number): string {
  return `q${number}`;
}

/** Whether the editor agrees with a reference verdict (auditor / system). */
export function agreement(mine: VerdictValue, reference: string | undefined | null): "agree" | "differ" | null {
  if (!reference) return null;
  return reference === mine ? "agree" : "differ";
}

/** Read / write the editor name; storage can be missing or throw. */
export function readEditor(storage: Pick<Storage, "getItem"> | undefined): string | null {
  try {
    const v = storage?.getItem(EDITOR_KEY);
    return v ? cleanEditorName(v) : null;
  } catch {
    return null;
  }
}

export function writeEditor(storage: Pick<Storage, "setItem" | "removeItem"> | undefined, name: string | null): void {
  try {
    if (name) storage?.setItem(EDITOR_KEY, name);
    else storage?.removeItem(EDITOR_KEY);
  } catch {
    // private window / blocked storage: the name lives only in memory
  }
}

// ---------------------------------------------------------------------------
// Task flow (one query at a time)
// ---------------------------------------------------------------------------
export const VERDICT_HELP: Record<VerdictValue, string> = {
  yes: "The article is mainly about this query.",
  border: "Only partly, or the query is a side point.",
  no: "The article is not about this query.",
};

export const VERDICT_CHOICE: Record<VerdictValue, string> = {
  yes: "Yes",
  border: "Borderline",
  no: "No",
};

/** The AI judge's answer as yes / border / no: the labels format, or a legacy belongs-only verdict. */
export function judgeLabel(
  verdict: { label?: VerdictValue; belongs?: boolean | null } | null | undefined,
): VerdictValue | null {
  if (!verdict) return null;
  if (verdict.label === "yes" || verdict.label === "border" || verdict.label === "no") return verdict.label;
  if (typeof verdict.belongs === "boolean") return verdict.belongs ? "yes" : "no";
  return null;
}

export const HOWTO_KEY = "u24-review-howto-hidden";

/** Link to one task: a batch, one query, one part. */
export function taskHref(batchId: number, query: number, part = 1): string {
  return `/review?batch=${batchId}&query=${query}&part=${part}`;
}

export function parseTask(params: { get(name: string): string | null }):
  | { batchId: number; query: number; part: number }
  | null {
  const batchId = Number(params.get("batch"));
  const query = Number(params.get("query"));
  const part = Number(params.get("part") ?? "1") || 1;
  if (!Number.isInteger(batchId) || batchId <= 0) return null;
  if (![1, 2, 3].includes(query)) return null;
  return { batchId, query, part };
}

/** "Article 38 of 150" — the one on screen, never past the total. */
export function articleNumber(done: number, total: number): number {
  return Math.min(done + 1, Math.max(total, 1));
}

export type TaskState = "new" | "started" | "done";

export function taskState(done: number, total: number): TaskState {
  if (total > 0 && done >= total) return "done";
  return done > 0 ? "started" : "new";
}

export const TASK_BUTTON: Record<TaskState, string> = {
  new: "Start",
  started: "Continue",
  done: "Done",
};

/** Did the system put the article in query `n`? Audit rows say e.g.
 * "2 Winter defense & resilience" (several joined by ";"), monthly rows say
 * "yes" / "no" for their own query. */
export function systemIncluded(value: string | undefined | null, n: number, monthly: boolean): boolean | null {
  if (value == null) return null;
  if (monthly) return value === "yes" ? true : value === "no" ? false : null;
  return new RegExp(`(^|[;,|]\\s*)${n}(\\s|$)`).test(value.trim());
}
