import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's built-in TypeScript stripping requires the source suffix.
import { explainScore, ruleText, signed } from "./score-explanation.ts";

const v2 = (over: Record<string, unknown> = {}, detail: Record<string, unknown> = {}) => ({
  stance: -2,
  stance_label: "critical" as const,
  fact_status: "confirmed",
  coverage_label: "favorable",
  stance_detail: {
    event: "Hungary blocked the EU loan to Ukraine",
    actor: "international",
    direction: "harms",
    evidence: "Hungary blocked the EU loan to Ukraine on Monday",
    evidence_verified: true,
    rationale: "The strike is reported as done.",
    ...detail,
  },
  ...over,
});

test("not enriched → none", () => {
  assert.deepEqual(
    explainScore({ stance: null, stance_label: null, fact_status: null, coverage_label: null, stance_detail: null }),
    { version: "none" },
  );
});

test("enriched without v2 answers → old method", () => {
  const e = explainScore({ stance: 2, stance_label: "supportive", fact_status: null, coverage_label: null, stance_detail: null });
  assert.deepEqual(e, { version: "v1", score: 2 });
});

test("confirmed partner decision: rule, quote and coverage", () => {
  const e = explainScore(v2());
  assert.equal(e.version, "v2");
  if (e.version !== "v2") return;
  assert.equal(e.rule, "Confirmed + harms Ukraine → −2");
  assert.equal(e.evidenceFound, true);
  assert.equal(e.coverage, "favorable");
  assert.equal(e.downgrade, null);
});

test("downgraded confirmed is explained", () => {
  const e = explainScore(
    v2({ stance: -1, fact_status: "announced" }, { evidence_verified: false, claimed_fact_status: "confirmed" }),
  );
  if (e.version !== "v2") throw new Error("expected v2");
  assert.match(e.downgrade ?? "", /quote was not found/);
  assert.equal(e.rule, "Announced + harms Ukraine → −1 (not confirmed, so at most ±1)");
});

test("rule texts", () => {
  assert.equal(ruleText("opinion", "helps", 1), "Opinion + helps Ukraine → +1 (not confirmed, so at most ±1)");
  assert.equal(ruleText("confirmed", "both", 0), "Confirmed + effects both ways → 0, Mixed");
  assert.equal(ruleText("none", "none", 0), "No Ukraine-relevant development → 0");
  assert.equal(signed(-2), "−2");
  assert.equal(signed(0), "0");
});

test("unknown values fall back safely", () => {
  const e = explainScore(v2({ coverage_label: "pro" }, { direction: "sideways", event: "  " }));
  if (e.version !== "v2") throw new Error("expected v2");
  assert.equal(e.direction, "none");
  assert.equal(e.coverage, null);
  assert.equal(e.event, null);
});

test("confirmed strike is a war event: −1 with the reason", () => {
  const e = explainScore(
    v2({ stance: -1, stance_label: "critical" }, { actor: "russia", direction: "harms" }),
  );
  if (e.version !== "v2") throw new Error("expected v2");
  assert.equal(e.actor, "russia");
  assert.equal(
    e.rule,
    "Confirmed + harms Ukraine → −1 (a war event or Ukrainian news, not a decision by another state, so at most ±1)",
  );
  assert.equal(e.coverage, "favorable");
});

test("unconfirmed war event is 0", () => {
  assert.equal(ruleText("opinion", "harms", 0, "russia"), "A war event or Ukrainian news that is not confirmed → 0");
});
