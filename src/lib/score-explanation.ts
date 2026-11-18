import type { Mention } from "./types";

/**
 * Plain-language explanation of a mention's favorability score for the
 * hover card. Mirrors the backend rules in docs/campaign/FAVORABILITY.md
 * (prompt `ua-fav-v3`): the model answers what happened, who acted, its
 * status and its effect on Ukraine; the score comes from a fixed table.
 * Decisions of other states or international bodies: confirmed ±2, otherwise
 * ±1. War events, Russia's own actions and Ukrainian news: ±1, confirmed only.
 */

export type FactStatus = "confirmed" | "announced" | "opinion" | "none";
export type Direction = "helps" | "harms" | "both" | "none";
export type Actor = "international" | "russia" | "ukraine" | "none";
export type CoverageLabel = "favorable" | "neutral" | "unfavorable" | "mixed";

export const FACT_STATUS_TEXT: Record<FactStatus, { label: string; meaning: string }> = {
  confirmed: {
    label: "Confirmed",
    meaning: "a decision was taken or an action happened",
  },
  announced: {
    label: "Announced",
    meaning: "an intention, plan or proposal — no decision yet",
  },
  opinion: {
    label: "Opinion",
    meaning: "commentary, forecast or an unconfirmed claim",
  },
  none: {
    label: "None",
    meaning: "no development that matters for Ukraine",
  },
};

export const ACTOR_TEXT: Record<Actor, string> = {
  international: "Another state or international body",
  russia: "Russia",
  ukraine: "Ukraine",
  none: "No clear actor",
};

export const DIRECTION_TEXT: Record<Direction, string> = {
  helps: "Helps Ukraine",
  harms: "Harms Ukraine",
  both: "Both ways",
  none: "No effect",
};

export const COVERAGE_TEXT: Record<CoverageLabel, { label: string; meaning: string }> = {
  favorable: {
    label: "Favorable",
    meaning: "shows Russia as responsible, Ukraine's need or resilience, or rebuts Kremlin claims",
  },
  neutral: {
    label: "Neutral",
    meaning: "no framing either way",
  },
  unfavorable: {
    label: "Unfavorable",
    meaning: "relays Kremlin claims unchallenged or argues against supporting Ukraine",
  },
  mixed: {
    label: "Mixed",
    meaning: "strong material pulling both ways",
  },
};

export type ScoreExplanation =
  | {
      version: "v2";
      score: number;
      event: string | null;
      status: FactStatus;
      actor: Actor;
      direction: Direction;
      /** e.g. "Confirmed + harms Ukraine → −2". */
      rule: string;
      /** Why a confirmed claim was counted as announced, if it was. */
      downgrade: string | null;
      evidence: string | null;
      evidenceFound: boolean;
      coverage: CoverageLabel | null;
      reasoning: string | null;
    }
  | { version: "v1"; score: number | null }
  | { version: "none" };

const STATUSES: FactStatus[] = ["confirmed", "announced", "opinion", "none"];
const DIRECTIONS: Direction[] = ["helps", "harms", "both", "none"];
const ACTORS: Actor[] = ["international", "russia", "ukraine", "none"];
const COVERAGES: CoverageLabel[] = ["favorable", "neutral", "unfavorable", "mixed"];

export function signed(score: number): string {
  if (score > 0) return `+${score}`;
  if (score < 0) return `−${Math.abs(score)}`;
  return "0";
}

function pick<T extends string>(value: unknown, allowed: T[]): T | null {
  return typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The scoring rule in words: actor, status and effect → score. */
export function ruleText(
  status: FactStatus,
  direction: Direction,
  score: number,
  actor: Actor = "international",
): string {
  if (status === "none") return "No Ukraine-relevant development → 0";
  if (actor === "none") return "No state, army or government acted → 0";
  const war = actor === "russia" || actor === "ukraine";
  if (war && status !== "confirmed")
    return "A war event or Ukrainian news that is not confirmed → 0";
  if (direction === "none") return "No effect on Ukraine → 0";
  if (direction === "both") return `${FACT_STATUS_TEXT[status].label} + effects both ways → 0, Mixed`;
  const effect = direction === "helps" ? "helps" : "harms";
  const cap = war
    ? " (a war event or Ukrainian news, not a decision by another state, so at most ±1)"
    : status === "confirmed"
      ? ""
      : " (not confirmed, so at most ±1)";
  return `${FACT_STATUS_TEXT[status].label} + ${effect} Ukraine → ${signed(score)}${cap}`;
}

export function explainScore(
  mention: Pick<
    Mention,
    "stance" | "stance_label" | "fact_status" | "coverage_label" | "stance_detail"
  >,
): ScoreExplanation {
  if (!mention.stance_label) return { version: "none" };
  const status = pick(mention.fact_status, STATUSES);
  const detail = mention.stance_detail ?? null;
  if (!status || !detail) return { version: "v1", score: mention.stance };

  const direction = pick(detail.direction, DIRECTIONS) ?? "none";
  // Rows scored before the actor question existed had no `actor`.
  const actor = pick(detail.actor, ACTORS) ?? "international";
  const score = mention.stance ?? 0;
  const claimed = pick(detail.claimed_fact_status, STATUSES);
  return {
    version: "v2",
    score,
    event: text(detail.event),
    status,
    actor,
    direction,
    rule: ruleText(status, direction, score, actor),
    downgrade:
      claimed && claimed !== status
        ? `The model said “${FACT_STATUS_TEXT[claimed].label.toLowerCase()}”, but its quote was not found in the article, so it counts as ${FACT_STATUS_TEXT[status].label.toLowerCase()}.`
        : null,
    evidence: text(detail.evidence),
    evidenceFound: detail.evidence_verified === true,
    coverage: pick(mention.coverage_label, COVERAGES),
    reasoning: text(detail.rationale),
  };
}
