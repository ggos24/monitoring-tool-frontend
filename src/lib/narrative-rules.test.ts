import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import {
  allTerms,
  autoAcceptLabel,
  buildSteps,
  formatAgo,
  formatEvery,
  formatTerm,
  hasAnyEnding,
  moreLabel,
  previewList,
  syncState,
  waitingItems,
  wordGroupTitle,
} from "./narrative-rules.ts";
import type { NarrativeRules } from "./types";

const baseRules: NarrativeRules = {
  type: "topic",
  exclusions: ["olympic*", "fifa"],
  key_phrases: ["ukrenergo", "kyiv blackout*"],
  required_words: [],
  word_groups: [
    { label: "А", description: "Україна", terms: ["ukrain*", "kyiv"] },
    { label: "Б", description: null, terms: ["blackout*", "heating"] },
  ],
  brand_names: [],
  auto_accept_axes: [],
};

test("formatTerm turns a trailing * into … at word ends only", () => {
  assert.equal(formatTerm("blackout*"), "blackout…");
  assert.equal(formatTerm("patriot* for ukraine"), "patriot… for ukraine");
  assert.equal(formatTerm("  kyiv  "), "kyiv");
  assert.equal(formatTerm("a*b"), "a*b");
});

test("hasAnyEnding spots the wildcard", () => {
  assert.equal(hasAnyEnding(["kyiv", "odesa"]), false);
  assert.equal(hasAnyEnding(["kyiv", "zelensk*"]), true);
  assert.equal(hasAnyEnding(["air defen* systems"]), true);
});

test("previewList keeps the first N and counts the rest", () => {
  assert.deepEqual(previewList([1, 2, 3], 5), { shown: [1, 2, 3], hidden: 0 });
  assert.deepEqual(previewList([1, 2, 3, 4, 5, 6, 7], 5), {
    shown: [1, 2, 3, 4, 5],
    hidden: 2,
  });
  assert.equal(moreLabel(10), "+10 more");
  assert.equal(moreLabel(0), "");
});

test("wordGroupTitle uses the description, else a numbered fallback", () => {
  assert.equal(wordGroupTitle(baseRules.word_groups[0], 0), "Україна");
  assert.equal(wordGroupTitle(baseRules.word_groups[1], 1), "Word group 2");
  assert.equal(
    wordGroupTitle({ label: null, description: "   ", terms: [] }, 2),
    "Word group 3",
  );
});

test("buildSteps: topic with two word groups says BOTH", () => {
  const steps = buildSteps(baseRules);
  assert.deepEqual(
    steps.map((s) => s.kind),
    ["exclusions", "key_phrases", "word_groups"],
  );
  assert.match(steps[0].text, /^Skipped if it mentions any of 2 excluded words/);
  assert.match(steps[1].text, /one of 2 key phrases$/);
  assert.equal(steps[2].text, "Otherwise taken only if it mentions a word from BOTH groups");
});

test("buildSteps: any number of word groups", () => {
  const three = buildSteps({
    ...baseRules,
    word_groups: [
      { label: null, description: null, terms: ["a"] },
      { label: null, description: null, terms: ["b"] },
      { label: null, description: null, terms: ["c"] },
    ],
  });
  assert.equal(three[2].text, "Otherwise taken only if it mentions a word from ALL 3 groups");

  const one = buildSteps({
    ...baseRules,
    word_groups: [{ label: null, description: null, terms: ["a"] }],
  });
  assert.equal(one[2].text, "Otherwise taken only if it mentions a word from this group");

  const none = buildSteps({ ...baseRules, word_groups: [] });
  assert.equal(none[2].text, "Otherwise taken: no word groups are set.");
});

test("buildSteps: brand adds a brand-name step before the groups", () => {
  const steps = buildSteps({
    ...baseRules,
    type: "brand",
    exclusions: [],
    brand_names: ["united24", "u24 media"],
    word_groups: [{ label: "А", description: null, terms: ["united24"] }],
    auto_accept_axes: ["U"],
  });
  assert.deepEqual(
    steps.map((s) => s.kind),
    ["exclusions", "key_phrases", "brand_names", "word_groups"],
  );
  assert.equal(steps[0].text, "No excluded words.");
  assert.match(steps[2].text, /names the brand \(2 names\)/);
  assert.equal(steps[3].text, "Then taken only if it mentions a word from this group");
});

test("buildSteps: brand names are ignored for topic-type narratives", () => {
  const steps = buildSteps({ ...baseRules, brand_names: ["x"] });
  assert.ok(!steps.some((s) => s.kind === "brand_names"));
});

test("buildSteps: required words appear when the backend sends them", () => {
  const steps = buildSteps({ ...baseRules, required_words: ["russia"] });
  assert.equal(steps[2].kind, "required_words");
  assert.match(steps[2].text, /^Otherwise skipped unless it mentions one of 1 required word$/);
  assert.match(steps[3].text, /^Then taken only if/);
});

test("buildSteps: empty word groups are not counted", () => {
  const steps = buildSteps({
    ...baseRules,
    word_groups: [
      { label: null, description: null, terms: ["a"] },
      { label: null, description: null, terms: [] },
    ],
  });
  assert.equal(steps[2].text, "Otherwise taken only if it mentions a word from this group");
});

test("allTerms collects every list", () => {
  assert.equal(allTerms(baseRules).length, 8);
});

test("autoAcceptLabel names UNITED24 for axis U", () => {
  assert.equal(autoAcceptLabel("U"), "pool articles that link to or mention UNITED24");
  assert.equal(autoAcceptLabel("X"), 'pool articles collected for "X"');
});

test("waitingItems merges editor-decision subtopics with parked terms", () => {
  const items = waitingItems(
    [
      { name: "Strikes", status: "active", description: null },
      { name: "Q4 · Cities", status: "editor_decision", description: "…" },
      { name: "Shadow fleet", status: "editor_decision", description: null },
    ],
    [
      { name: "Q4 · Cities", count: 14 },
      { name: "Q3 · Truce", count: 3 },
    ],
  );
  assert.deepEqual(items, [
    { name: "Q4 · Cities", count: 14 },
    { name: "Shadow fleet", count: null },
    { name: "Q3 · Truce", count: 3 },
  ]);
});

test("syncState", () => {
  assert.equal(syncState(null), null);
  assert.equal(syncState({ file: "a.json", version: null, in_sync: true }), "in_sync");
  assert.equal(syncState({ file: "a.json", version: "v2", in_sync: false }), "differs");
});

test("formatAgo", () => {
  const now = Date.parse("2026-11-09T12:00:00Z");
  assert.equal(formatAgo(null, now), "never");
  assert.equal(formatAgo("nope", now), "unknown");
  assert.equal(formatAgo("2026-11-09T11:59:30Z", now), "just now");
  assert.equal(formatAgo("2026-11-09T11:59:00Z", now), "1 minute ago");
  assert.equal(formatAgo("2026-11-09T11:15:00Z", now), "45 minutes ago");
  assert.equal(formatAgo("2026-11-09T09:00:00Z", now), "3 hours ago");
  assert.equal(formatAgo("2026-11-06T12:00:00Z", now), "3 days ago");
  // Clock skew: a future timestamp never reads as negative.
  assert.equal(formatAgo("2026-11-09T12:05:00Z", now), "just now");
});

test("formatEvery", () => {
  assert.equal(formatEvery(7200), "2 hours");
  assert.equal(formatEvery(3600), "1 hour");
  assert.equal(formatEvery(1800), "30 minutes");
  assert.equal(formatEvery(45), "45 seconds");
});
