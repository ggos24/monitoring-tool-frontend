import type { Actor, CoverageLabel, Direction, FactStatus } from "./score-explanation";

/**
 * Review → Favorability: the questions editors answer, in the same terms as
 * the model's prompt (backend docs/campaign/FAVORABILITY.md). The score is
 * computed from the answers with the prompt's own table, so editor and model
 * scores are comparable.
 */

export type FavAnswers = {
  fact_status: FactStatus;
  actor: Actor;
  direction: Direction;
  coverage: CoverageLabel;
};

export type FavDraft = { [K in keyof FavAnswers]: FavAnswers[K] | null } & { comment: string };

export const EMPTY_FAV_DRAFT: FavDraft = {
  fact_status: null,
  actor: null,
  direction: null,
  coverage: null,
  comment: "",
};

export type Question<K extends keyof FavAnswers = keyof FavAnswers> = {
  key: K;
  title: string;
  help: string;
  options: Array<{ value: FavAnswers[K]; label: string; hint: string }>;
};

export const QUESTIONS: Question[] = [
  {
    key: "actor",
    title: "Who decided or acted?",
    help: "Decisions of other states and international bodies weigh most (±2). Confirmed war events, Russia's actions and Ukrainian news count ±1. If the article has a partner's step, pick that.",
    options: [
      { value: "international", label: "Another state or international body", hint: "US, EU, Hungary, NATO, G7, UN, a court; also China or North Korea" },
      { value: "russia", label: "Russia", hint: "strikes, advances, mobilisation, war budget" },
      { value: "ukraine", label: "Ukraine", hint: "army, government, reforms, scandals" },
      { value: "none", label: "No clear actor", hint: "a report or analysis with no decision" },
    ],
  },
  {
    key: "fact_status",
    title: "Did it actually happen?",
    help: "Judge only from the article. A statement counts as confirmed when it is the decision itself (“Trump confirmed the aid”).",
    options: [
      { value: "confirmed", label: "Confirmed", hint: "approved, signed, delivered, adopted, voted" },
      { value: "announced", label: "Announced", hint: "plans to, considering, will discuss, pledged" },
      { value: "opinion", label: "Opinion", hint: "should, could, analysts say, claims, forecast" },
      { value: "none", label: "Nothing happened", hint: "no development that matters for Ukraine" },
    ],
  },
  {
    key: "direction",
    title: "Is it good or bad for Ukraine?",
    help: "The real effect on Ukraine, not the tone of the article.",
    options: [
      { value: "helps", label: "Helps", hint: "aid, sanctions on Russia, EU / NATO steps" },
      { value: "harms", label: "Harms", hint: "aid blocked or cut, sanctions eased, pressure to concede" },
      { value: "both", label: "Both", hint: "one decision with strong effects both ways" },
      { value: "none", label: "Neither", hint: "no effect either way" },
    ],
  },
  {
    key: "coverage",
    title: "How does the article present it?",
    help: "A separate question: whose side the presentation takes, whatever happened.",
    options: [
      { value: "favorable", label: "Favorable", hint: "Russia responsible, Ukraine's need or resilience, rebuts Kremlin claims" },
      { value: "neutral", label: "Neutral", hint: "no framing either way" },
      { value: "unfavorable", label: "Unfavorable", hint: "Kremlin claims unchallenged, argues against support" },
      { value: "mixed", label: "Mixed", hint: "strong material pulling both ways" },
    ],
  },
];

const WEIGHT: Record<FactStatus, number> = { confirmed: 2, announced: 1, opinion: 1, none: 0 };
const WAR_WEIGHT: Record<FactStatus, number> = { confirmed: 1, announced: 0, opinion: 0, none: 0 };

/** Score −2..+2 from answers — the prompt's table: another state or
 * international body up to ±2; Russia / Ukraine ±1 when confirmed. */
export function favScore(a: Pick<FavAnswers, "fact_status" | "actor" | "direction">): number {
  const w =
    a.actor === "international"
      ? WEIGHT[a.fact_status]
      : a.actor === "russia" || a.actor === "ukraine"
        ? WAR_WEIGHT[a.fact_status]
        : 0;
  if (w === 0) return 0;
  if (a.direction === "helps") return w;
  if (a.direction === "harms") return -w;
  return 0;
}

export function isComplete(d: FavDraft): d is FavDraft & FavAnswers {
  return d.fact_status !== null && d.actor !== null && d.direction !== null && d.coverage !== null;
}

export function draftScore(d: FavDraft): number | null {
  return isComplete(d) ? favScore(d) : null;
}

export function optionLabel<K extends keyof FavAnswers>(key: K, value: FavAnswers[K]): string {
  return QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === value)?.label ?? String(value);
}

/** Per question: did the model answer the same as the editor? */
export function compareAnswers(
  mine: FavAnswers,
  model: FavAnswers | null,
): Array<{ key: keyof FavAnswers; mine: string; model: string | null; same: boolean | null }> {
  return QUESTIONS.map((q) => ({
    key: q.key,
    mine: optionLabel(q.key, mine[q.key]),
    model: model ? optionLabel(q.key, model[q.key]) : null,
    same: model ? model[q.key] === mine[q.key] : null,
  }));
}
