import type { TopicAst, TopicAstPatch, TopicTerms } from "./types";

function arrayEq(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

function termsEq(a: TopicTerms, b: TopicTerms): boolean {
  return (
    arrayEq(a.core, b.core) &&
    arrayEq(a.context, b.context) &&
    arrayEq(a.phrases, b.phrases) &&
    arrayEq(a.hashtags, b.hashtags)
  );
}

// Build a minimal patch for PATCH /api/topics/{id}/ast.
//
// Backend REPLACES top-level keys (no deep merge). So when any nested field
// inside `terms` changes, we send the full terms object. schema_version and
// provenance are stripped — backend rejects them via extra="forbid".
export function buildAstPatch(
  orig: TopicAst,
  edited: TopicAst,
): TopicAstPatch {
  const patch: TopicAstPatch = {};

  if (orig.canonical_name !== edited.canonical_name) {
    patch.canonical_name = edited.canonical_name;
  }
  if (orig.type !== edited.type) {
    patch.type = edited.type;
  }
  if (orig.anchor_text !== edited.anchor_text) {
    patch.anchor_text = edited.anchor_text;
  }
  if (!arrayEq(orig.wikidata_qids, edited.wikidata_qids)) {
    patch.wikidata_qids = edited.wikidata_qids;
  }
  if (!arrayEq(orig.languages, edited.languages)) {
    patch.languages = edited.languages;
  }
  if (!termsEq(orig.terms, edited.terms)) {
    patch.terms = edited.terms;
  }
  if (!arrayEq(orig.must_co_occur, edited.must_co_occur)) {
    patch.must_co_occur = edited.must_co_occur;
  }
  if (!arrayEq(orig.must_not_co_occur, edited.must_not_co_occur)) {
    patch.must_not_co_occur = edited.must_not_co_occur;
  }
  if (!arrayEq(orig.gdelt_gkg_themes, edited.gdelt_gkg_themes)) {
    patch.gdelt_gkg_themes = edited.gdelt_gkg_themes;
  }
  if (!arrayEq(orig.entity_aliases, edited.entity_aliases)) {
    patch.entity_aliases = edited.entity_aliases;
  }
  if (!anchorsEq(orig.anchors, edited.anchors)) {
    patch.anchors = edited.anchors ?? [];
  }

  return patch;
}

// Group ORDER is meaningful (group 1 = subject axis, group 2 = action
// axis) so groups compare index-wise; token order within a group is not
// meaningful. `undefined` (pre-rework AST without the key) equals [].
function anchorsEq(
  a: readonly string[][] | undefined,
  b: readonly string[][] | undefined,
): boolean {
  const ga = a ?? [];
  const gb = b ?? [];
  if (ga.length !== gb.length) return false;
  return ga.every((group, i) => arrayEq(group, gb[i]));
}

export function isEmptyPatch(patch: TopicAstPatch): boolean {
  return Object.keys(patch).length === 0;
}
