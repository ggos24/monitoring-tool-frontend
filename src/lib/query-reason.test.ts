import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import { explainQueryReason } from "./query-reason.ts";

test("axis reasons name the axis in words (both backend formats)", () => {
  assert.match(
    explainQueryReason("axis", "accept_axes: harvested on axis U").detail,
    /United24/,
  );
  assert.match(explainQueryReason("axis", "harvest_axis U in accept_axes").detail, /United24/);
});

test("word rules quote the matched phrase or groups", () => {
  assert.match(
    explainQueryReason("lexical", "matched phrase 'energy truce' in title").detail,
    /“energy truce”/,
  );
  const e = explainQueryReason("killswitch", "embed disabled — anchor accept: ukraine, winter");
  assert.equal(e.source, "Word rules");
  assert.match(e.detail, /ukraine, winter/);
  assert.match(
    explainQueryReason("killswitch", "kill-switch — pass→accept (no anchors defined)").detail,
    /no word groups/,
  );
});

test("AI judge shows the subtopic", () => {
  const e = explainQueryReason("ai_judge", "claude-haiku-5-5: subtopic 2 Civilian impact");
  assert.equal(e.source, "AI judge");
  assert.match(e.detail, /subtopic 2 Civilian impact/);
});

test("unknown method falls back to the raw text", () => {
  assert.deepEqual(explainQueryReason("future", "x y"), { source: "future", detail: "x y" });
  assert.equal(explainQueryReason(null, null).source, "Unknown");
});
