import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import { countChange, diffChange } from "./period.ts";

test("list rows always show the plain difference, whatever the base", () => {
  assert.equal(diffChange(46, 2)?.text, "+44");
  assert.equal(diffChange(13, 16)?.text, "−3");
  assert.equal(diffChange(200, 100)?.text, "+100");
  assert.equal(diffChange(5, 5)?.text, "±0");
  assert.deepEqual(diffChange(8, 0), { text: "new", direction: "new" });
  assert.deepEqual(diffChange(0, 0), { text: "—", direction: "none" });
  assert.equal(diffChange(0, 4)?.direction, "down");
  assert.equal(diffChange(3, null), undefined);
});

test("KPI counts stay relative above the small base", () => {
  assert.equal(countChange(13, 16)?.text, "−19%");
  assert.equal(countChange(46, 2)?.text, "+44");
});
