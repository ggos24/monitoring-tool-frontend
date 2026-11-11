import type {
  NarrativeRules,
  NarrativeSpecRef,
  NarrativeSubtopic,
  NarrativeWordGroup,
} from "./types";

// Pure display helpers for Settings → Narratives. They turn the rules the
// matcher runs (GET /api/narratives → rules) into plain-English steps for
// editors. No jargon here on purpose: never "AST", "anchor", "matcher".

/** How many examples a list shows before "show all". */
// The topic group the dashboard shows as "All queries". Matched exactly,
// like the backend (app/api/narratives.py: TopicGroup.name == "Campaign"),
// so the dashboard, Advanced and the Narratives cards always agree.
export const CAMPAIGN_GROUP_NAME = "Campaign";

export function isCampaignGroupName(name: string): boolean {
  return name === CAMPAIGN_GROUP_NAME;
}

export const PREVIEW_COUNT = 6;

/**
 * A trailing `*` on a word means "any ending" (`blackout*` matches
 * blackout and blackouts). Shown as `…`, also inside phrases:
 * `patriot* for ukraine` → `patriot… for ukraine`.
 */
export function formatTerm(term: string): string {
  return term.trim().replace(/\*(?=\s|$)/g, "…");
}

/** True when any term uses the "any ending" wildcard. */
export function hasAnyEnding(terms: readonly string[]): boolean {
  return terms.some((t) => /\*(?=\s|$)/.test(t.trim()));
}

export const ANY_ENDING_NOTE =
  "A … means any ending: blackout… matches blackout and blackouts.";

/** First `limit` items plus how many are hidden behind "show all". */
export function previewList<T>(
  items: readonly T[],
  limit: number = PREVIEW_COUNT,
): { shown: T[]; hidden: number } {
  if (items.length <= limit) return { shown: [...items], hidden: 0 };
  return { shown: items.slice(0, limit), hidden: items.length - limit };
}

export function moreLabel(hidden: number): string {
  return hidden > 0 ? `+${hidden} more` : "";
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** Group title: the editors' description as given, else "Word group N". */
export function wordGroupTitle(group: NarrativeWordGroup, index: number): string {
  const d = group.description?.trim();
  return d ? d : `Word group ${index + 1}`;
}

/** Pool harvest axes a narrative takes without checking its rules. */
export function autoAcceptLabel(axis: string): string {
  if (axis.toUpperCase() === "U") {
    return "pool articles that link to or mention UNITED24";
  }
  return `pool articles collected for "${axis}"`;
}

export type RuleStep =
  | { kind: "exclusions"; text: string; terms: string[] }
  | { kind: "key_phrases"; text: string; terms: string[] }
  | { kind: "brand_names"; text: string; terms: string[] }
  | { kind: "required_words"; text: string; terms: string[] }
  | { kind: "word_groups"; text: string; groups: NarrativeWordGroup[] };

function groupsLead(n: number, first: boolean): string {
  const lead = first ? "Otherwise taken only if" : "Then taken only if";
  if (n === 1) return `${lead} it mentions a word from this group`;
  if (n === 2) return `${lead} it mentions a word from BOTH groups`;
  return `${lead} it mentions a word from ALL ${n} groups`;
}

/**
 * The numbered "How an article gets in" steps, in the order the matcher
 * applies them: exclusions → key phrases in the headline → (brand only)
 * brand names → required words → every word group.
 */
export function buildSteps(rules: NarrativeRules): RuleStep[] {
  const steps: RuleStep[] = [];

  const ex = rules.exclusions;
  steps.push({
    kind: "exclusions",
    text:
      ex.length > 0
        ? `Skipped if it mentions any of ${plural(ex.length, "excluded word", "excluded words")}`
        : "No excluded words.",
    terms: ex,
  });

  const kp = rules.key_phrases;
  steps.push({
    kind: "key_phrases",
    text:
      kp.length > 0
        ? `Taken right away if the headline contains one of ${plural(kp.length, "key phrase", "key phrases")}`
        : "No key phrases, so the next steps decide.",
    terms: kp,
  });

  // A later step checks only what the earlier ones did not decide.
  let first = true;
  if (rules.type === "brand" && rules.brand_names.length > 0) {
    steps.push({
      kind: "brand_names",
      text: `Otherwise skipped unless it names the brand (${plural(rules.brand_names.length, "name", "names")})`,
      terms: rules.brand_names,
    });
    first = false;
  }

  if (rules.required_words.length > 0) {
    steps.push({
      kind: "required_words",
      text: `${first ? "Otherwise skipped" : "Also skipped"} unless it mentions one of ${plural(rules.required_words.length, "required word", "required words")}`,
      terms: rules.required_words,
    });
    first = false;
  }

  const groups = rules.word_groups.filter((g) => g.terms.length > 0);
  steps.push({
    kind: "word_groups",
    text:
      groups.length > 0
        ? groupsLead(groups.length, first)
        : `${first ? "Otherwise" : "Then"} taken: no word groups are set.`,
    groups,
  });

  return steps;
}

/** Every term the card can show, for the "any ending" note. */
export function allTerms(rules: NarrativeRules): string[] {
  return [
    ...rules.exclusions,
    ...rules.key_phrases,
    ...rules.brand_names,
    ...rules.required_words,
    ...rules.word_groups.flatMap((g) => g.terms),
  ];
}

export function activeSubtopics(subtopics: readonly NarrativeSubtopic[]): NarrativeSubtopic[] {
  return subtopics.filter((s) => s.status === "active");
}

/**
 * Parts the editors have not decided on yet: subtopics with a status
 * other than active, plus parked term lists. One entry per name; the
 * term count comes from the parked list when there is one.
 */
export function waitingItems(
  subtopics: readonly NarrativeSubtopic[],
  waitingTerms: readonly { name: string; count: number }[],
): { name: string; count: number | null }[] {
  const out = new Map<string, number | null>();
  for (const s of subtopics) {
    if (s.status !== "active") out.set(s.name, null);
  }
  for (const w of waitingTerms) out.set(w.name, w.count);
  return [...out].map(([name, count]) => ({ name, count }));
}

export type SyncState = "in_sync" | "differs" | null;

export function syncState(spec: NarrativeSpecRef | null): SyncState {
  if (!spec) return null;
  return spec.in_sync ? "in_sync" : "differs";
}

/** "5 minutes ago", "3 hours ago", "2 days ago"; "never" for null. */
export function formatAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown";
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${plural(min, "minute", "minutes")} ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${plural(hr, "hour", "hours")} ago`;
  const day = Math.round(hr / 24);
  return `${plural(day, "day", "days")} ago`;
}

/** Schedule interval in words: 7200 → "2 hours". */
export function formatEvery(seconds: number): string {
  if (seconds % 3600 === 0) return plural(seconds / 3600, "hour", "hours");
  if (seconds % 60 === 0) return plural(seconds / 60, "minute", "minutes");
  return plural(seconds, "second", "seconds");
}
