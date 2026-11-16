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
