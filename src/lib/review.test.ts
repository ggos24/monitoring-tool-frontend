import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import {
  EMPTY_DRAFT,
  agreement,
  applySubtopic,
  applyVerdict,
  canSave,
  cleanEditorName,
  isTypingTarget,
  keyToAction,
  progressLabel,
  progressPercent,
  readEditor,
  writeEditor,
} from "./review.ts";

test("keyboard map", () => {
  assert.deepEqual(keyToAction("y"), { type: "verdict", verdict: "yes" });
  assert.deepEqual(keyToAction("B"), { type: "verdict", verdict: "border" });
  assert.deepEqual(keyToAction("n"), { type: "verdict", verdict: "no" });
  assert.deepEqual(keyToAction("3"), { type: "subtopic", subtopic: 3 });
  assert.equal(keyToAction("6"), null);
  assert.deepEqual(keyToAction("ArrowDown"), { type: "row", delta: 1 });
  assert.deepEqual(keyToAction("Enter"), { type: "save" });
  assert.deepEqual(keyToAction("s"), { type: "skip" });
  assert.deepEqual(keyToAction("o"), { type: "open" });
  assert.equal(keyToAction("x"), null);
});

test("shortcuts are off while typing", () => {
  assert.equal(isTypingTarget({ tagName: "textarea" }), true);
  assert.equal(isTypingTarget({ tagName: "INPUT" }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTypingTarget(null), false);
});

test("save needs a verdict for every query on the card", () => {
  const yes = applyVerdict(EMPTY_DRAFT, "yes");
  assert.equal(canSave({ 13: yes }, [13]), true);
  assert.equal(canSave({ 13: yes }, [13, 14]), false);
  assert.equal(canSave({}, []), false);
});

test("no clears the subtopic; same subtopic toggles off", () => {
  const withSub = applySubtopic(applyVerdict(EMPTY_DRAFT, "yes"), 2);
  assert.equal(withSub.subtopic, 2);
  assert.equal(applyVerdict(withSub, "no").subtopic, null);
  assert.equal(applyVerdict(withSub, "border").subtopic, 2);
  assert.equal(applySubtopic(withSub, 2).subtopic, null);
});

test("progress text", () => {
  assert.equal(progressLabel(37, 150), "37 of 150");
  assert.equal(progressPercent(37, 150), 25);
  assert.equal(progressPercent(0, 0), 0);
});

test("editor names", () => {
  assert.equal(cleanEditorName("  Olena   K "), "Olena K");
  assert.equal(cleanEditorName("   "), null);
  assert.equal(cleanEditorName("x".repeat(65)), null);
});

test("agreement with a reference verdict", () => {
  assert.equal(agreement("yes", "yes"), "agree");
  assert.equal(agreement("no", "border"), "differ");
  assert.equal(agreement("no", ""), null);
});

test("editor storage survives broken storage", () => {
  const store = new Map<string, string>();
  const ok = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  writeEditor(ok, "Olena");
  assert.equal(readEditor(ok), "Olena");
  writeEditor(ok, null);
  assert.equal(readEditor(ok), null);
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(readEditor(broken), null);
  writeEditor(broken, "Olena");
  assert.equal(readEditor(undefined), null);
});

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import { articleNumber, parseTask, systemIncluded, taskHref, taskState } from "./review.ts";

test("task links round-trip", () => {
  const href = taskHref(3, 2);
  const params = new URLSearchParams(href.split("?")[1]);
  assert.deepEqual(parseTask(params), { batchId: 3, query: 2, part: 1 });
  assert.equal(parseTask(new URLSearchParams("batch=1&query=7")), null);
  assert.equal(parseTask(new URLSearchParams("query=1")), null);
});

test("article number and task state", () => {
  assert.equal(articleNumber(37, 150), 38);
  assert.equal(articleNumber(150, 150), 150);
  assert.equal(taskState(0, 150), "new");
  assert.equal(taskState(3, 150), "started");
  assert.equal(taskState(150, 150), "done");
});

test("what the system decided", () => {
  assert.equal(systemIncluded("2 Winter defense & resilience", 2, false), true);
  assert.equal(systemIncluded("2 Winter defense & resilience", 1, false), false);
  assert.equal(systemIncluded("1 Prolonged war; 3 Supply chains", 3, false), true);
  assert.equal(systemIncluded("", 1, false), false);
  assert.equal(systemIncluded("yes", 1, true), true);
  assert.equal(systemIncluded("no", 1, true), false);
  assert.equal(systemIncluded(undefined, 1, true), null);
});

test("Yes clears the better-fit query, No and Borderline keep it", () => {
  const d = { ...applyVerdict(EMPTY_DRAFT, "no"), betterFit: 13 };
  assert.equal(applyVerdict(d, "border").betterFit, 13);
  assert.equal(applyVerdict(d, "yes").betterFit, null);
});
