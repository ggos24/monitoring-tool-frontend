import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import { activeFilterLabels } from "./article-filters.ts";

test("no active filter → no labels", () => {
  assert.deepEqual(activeFilterLabels({}), []);
  assert.deepEqual(activeFilterLabels({ stance: "all", source: "all", domain: null }), []);
});

test("labels use the article list's wording, in its order", () => {
  assert.deepEqual(
    activeFilterLabels({ stance: "supportive", source: "gn", domain: "www.reuters.com" }),
    ["Favorable", "Google News", "reuters.com"],
  );
  assert.deepEqual(activeFilterLabels({ stance: "critical" }), ["Unfavorable"]);
});
