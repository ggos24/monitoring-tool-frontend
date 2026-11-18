import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import { countChange, diffChange, formatShareFine, resolveWindow, spanWithin } from "./period.ts";

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

test("days picked on the timeline become the window, previous = same length before", () => {
  const period = { kind: "range" as const, from: "2026-10-18", to: "2026-11-17" };
  const win = resolveWindow(period, { from: "2026-11-07", to: "2026-11-12" });
  assert.equal(win.from, "2026-11-07T00:00:00.000Z");
  assert.equal(win.to, "2026-11-12T23:59:59.999Z");
  assert.equal(win.days, 6);
  assert.equal(win.granularity, "day");
  assert.equal(win.label, "Nov 7 – Nov 12");
  assert.equal(win.prevFrom, "2026-11-01T00:00:00.000Z");
  assert.equal(win.prevTo, "2026-11-06T23:59:59.999Z");
  const day = resolveWindow(period, { from: "2026-11-11", to: "2026-11-11" });
  assert.equal(day.days, 1);
  assert.equal(day.label, "Nov 11");
});

test("a picked span counts only while it sits inside the period", () => {
  const win = resolveWindow({ kind: "range", from: "2026-10-18", to: "2026-11-17" }, null);
  assert.equal(spanWithin({ from: "2026-10-18", to: "2026-11-17" }, win), true);
  assert.equal(spanWithin({ from: "2026-10-17", to: "2026-10-20" }, win), false);
  assert.equal(spanWithin({ from: "2026-11-10", to: "2026-11-18" }, win), false);
});

test("formatShareFine keeps two decimals below 1%", () => {
  assert.equal(formatShareFine(0.0022), "0.22%");
  assert.equal(formatShareFine(0.048), "4.8%");
  assert.equal(formatShareFine(0), "0.0%");
});
