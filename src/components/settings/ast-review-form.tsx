"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import { buildAstPatch, isEmptyPatch } from "@/lib/ast-diff";
import { cn } from "@/lib/utils";
import type {
  TopicAst,
  TopicAstPatch,
  TopicCreateOut,
  TopicType,
} from "@/lib/types";

import { ChipList } from "./chip-list";
import { ProvenancePanel } from "./provenance-panel";

const QID_RE = /^Q\d+$/;

type Props = {
  initial: TopicCreateOut;
};

export function AstReviewForm({ initial }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // origin: the AST currently persisted on the server (changes when a save lands).
  // edited: operator's working copy.
  const [origin, setOrigin] = useState<TopicCreateOut>(initial);
  const [edited, setEdited] = useState<TopicAst>(initial.topic_ast);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "error"; message: string }
    | { kind: "saved" }
  >({ kind: "idle" });

  useEffect(() => {
    setOrigin(initial);
    setEdited(initial.topic_ast);
  }, [initial]);

  useEffect(() => {
    if (status.kind !== "saved") return;
    const t = setTimeout(() => setStatus({ kind: "idle" }), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const patch = useMemo<TopicAstPatch>(
    () => buildAstPatch(origin.topic_ast, edited),
    [origin.topic_ast, edited],
  );

  const dirty = !isEmptyPatch(patch);
  const anchorChanged = patch.anchor_text !== undefined;

  const saveMutation = useMutation({
    mutationFn: (p: TopicAstPatch) =>
      apiClient.updateTopicAst(origin.id, p),
    onSuccess: (response) => {
      setOrigin(response);
      setEdited(response.topic_ast);
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      setStatus({ kind: "saved" });
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : "Save failed — try again.";
      setStatus({ kind: "error", message });
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => apiClient.updateTopic(origin.id, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      router.push("/");
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? `Activate failed: ${err.message}`
          : "Activate failed — try again.";
      setStatus({ kind: "error", message });
    },
  });

  function handleSave() {
    if (!dirty) return;
    if (anchorChanged) {
      const ok = window.confirm(
        "Editing the anchor text will regenerate the semantic embedding. Continue?",
      );
      if (!ok) return;
    }
    setStatus({ kind: "idle" });
    saveMutation.mutate(patch);
  }

  function handleActivate() {
    if (dirty) {
      const ok = window.confirm(
        "You have unsaved AST changes. Activate without saving them?",
      );
      if (!ok) return;
    }
    setStatus({ kind: "idle" });
    activateMutation.mutate();
  }

  const saving = saveMutation.isPending;
  const activating = activateMutation.isPending;
  const ast = edited;

  return (
    <div className="space-y-6">
      <header className="space-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-mono text-base text-foreground">
            {ast.canonical_name}
          </h2>
          <TypeBadge
            type={ast.type}
            onToggle={(next) => setEdited({ ...ast, type: next })}
          />
          <span
            className={cn(
              "ml-auto font-mono text-[11px]",
              origin.is_active ? "text-emerald-400" : "text-text-tertiary",
            )}
          >
            {origin.is_active ? "● Active" : "○ Inactive"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Wikidata
          </span>
          {ast.wikidata_qids.length === 0 ? (
            <span className="font-mono text-[11px] text-muted-foreground">(none)</span>
          ) : (
            ast.wikidata_qids.map((qid) =>
              QID_RE.test(qid) ? (
                <a
                  key={qid}
                  href={`https://www.wikidata.org/wiki/${qid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-border bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-sky-300 hover:border-sky-800"
                >
                  {qid}
                </a>
              ) : (
                <span
                  key={qid}
                  className="border border-border bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-text-tertiary"
                  title="Not a valid QID format"
                >
                  {qid}
                </span>
              ),
            )
          )}
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          anchor_embedding_version: {origin.anchor_embedding_version}{" "}
          {origin.anchor_embedded ? "✓" : "(embed failed — operator should retry)"}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChipList
          label="Core terms"
          items={ast.terms.core}
          maxItems={10}
          helpText="Direct name variants of the topic. A headline containing one is auto-accepted with no further checks — never add generic words (war, economy) here."
          placeholder="+ add core term"
          onChange={(next) =>
            setEdited({ ...ast, terms: { ...ast.terms, core: next } })
          }
        />
        <ChipList
          label="Context"
          items={ast.terms.context}
          maxItems={10}
          helpText="Related descriptors kept for reference. Not matched against headlines and not sent in queries."
          placeholder="+ add context"
          onChange={(next) =>
            setEdited({ ...ast, terms: { ...ast.terms, context: next } })
          }
        />
        <ChipList
          label="Phrases"
          items={ast.terms.phrases}
          maxItems={10}
          helpText="Exact multi-word phrases. Auto-accept on headline match (tolerant of commas and apostrophe style); quoted in Google News queries."
          placeholder='+ add "exact phrase"'
          onChange={(next) =>
            setEdited({ ...ast, terms: { ...ast.terms, phrases: next } })
          }
        />
        <ChipList
          label="Hashtags"
          items={ast.terms.hashtags}
          maxItems={10}
          helpText="Without leading #. Matched on social-media sources."
          placeholder="+ add hashtag"
          onChange={(next) =>
            setEdited({ ...ast, terms: { ...ast.terms, hashtags: next } })
          }
        />
      </section>

      <AnchorGroupsSection
        anchors={ast.anchors ?? []}
        topicType={ast.type}
        onChange={(next) => setEdited({ ...ast, anchors: next })}
      />

      <ChipList
        label="Exclude these (must_not_co_occur)"
        items={ast.must_not_co_occur}
        maxItems={20}
        helpText="Hard filter: any mention containing one of these phrases is dropped immediately. Use for wrong-sense lookalikes; too-broad exclusions silently kill real coverage."
        placeholder="+ add exclusion"
        onChange={(next) => setEdited({ ...ast, must_not_co_occur: next })}
      />

      {ast.type === "brand" && (
        <ChipList
          label="Brand aliases (entity_aliases)"
          items={ast.entity_aliases}
          maxItems={30}
          helpText="Strong-name aliases enforced by the entity gate for brand-type topics."
          placeholder="+ add alias"
          onChange={(next) => setEdited({ ...ast, entity_aliases: next })}
        />
      )}

      <section className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            Semantic anchor
          </span>
          {anchorChanged && (
            <span className="font-mono text-[10px] text-amber-500">
              edited — will re-embed on save
            </span>
          )}
        </div>
        <textarea
          value={ast.anchor_text}
          onChange={(e) => setEdited({ ...ast, anchor_text: e.target.value })}
          rows={4}
          minLength={10}
          maxLength={2000}
          className={cn(
            "block w-full border border-border bg-card px-3 py-2",
            "font-mono text-[12px] leading-relaxed text-foreground",
            "outline-none transition-colors hover:border-strong focus:border-strong",
          )}
        />
        <p className="font-mono text-[10px] text-muted-foreground">
          2–3 sentences describing what the topic is &ldquo;about&rdquo;.
          Embedded by Gemini and used as the cosine-similarity reference for
          borderline mentions. {ast.anchor_text.length}/2000 chars
          {ast.anchor_text.length < 10 && (
            <span className="ml-1 text-red-400">(min 10)</span>
          )}
        </p>
      </section>

      <ProvenancePanel provenance={origin.topic_ast.provenance} />

      <footer className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
        <div className="font-mono text-[11px]">
          {status.kind === "saved" && (
            <span className="text-emerald-400">Saved ✓</span>
          )}
          {status.kind === "error" && (
            <span className="text-red-400">{status.message}</span>
          )}
          {status.kind === "idle" && dirty && (
            <span className="text-amber-500">Unsaved changes</span>
          )}
          {status.kind === "idle" && !dirty && (
            <span className="text-muted-foreground">No changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving || activating || ast.anchor_text.length < 10}
            className={cn(
              "border px-3 py-1 font-mono text-[11px] transition-colors",
              !dirty || saving || activating || ast.anchor_text.length < 10
                ? "cursor-not-allowed border-border bg-card text-text-tertiary"
                : "cursor-pointer border-strong bg-foreground text-primary-foreground hover:bg-text-secondary",
            )}
          >
            {saving
              ? anchorChanged
                ? "Re-embedding…"
                : "Saving…"
              : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleActivate}
            disabled={origin.is_active || activating || saving}
            className={cn(
              "border px-3 py-1 font-mono text-[11px] transition-colors",
              origin.is_active
                ? "cursor-not-allowed border-emerald-900 bg-emerald-950 text-emerald-400"
                : activating || saving
                  ? "cursor-not-allowed border-border bg-card text-text-tertiary"
                  : "cursor-pointer border-emerald-900 bg-emerald-950 text-emerald-400 hover:border-emerald-800",
            )}
          >
            {origin.is_active
              ? "Already active"
              : activating
                ? "Activating…"
                : "Activate"}
          </button>
        </div>
      </footer>
    </div>
  );
}

// Anchor groups (backend 2026-07-30 matcher rework). One field, three
// jobs: (1) for topic-type topics the groups compile into the GDELT
// query — an article is fetched only when its FULL TEXT contains a word
// from every group; (2) the free anchor gate — a HEADLINE must also hit
// every group to be accepted without any LLM spend; (3) borderline
// mentions get their provisional visible/hidden verdict from the same
// check while they wait for the nightly LLM judge.
function AnchorGroupsSection({
  anchors,
  topicType,
  onChange,
}: {
  anchors: string[][];
  topicType: TopicType;
  onChange: (next: string[][]) => void;
}) {
  const groupOne = anchors[0] ?? [];
  const groupTwo = anchors[1] ?? [];
  const enabled = groupOne.length > 0 || groupTwo.length > 0;

  function setGroup(index: 0 | 1, next: string[]) {
    const groups = [anchors[0] ?? [], anchors[1] ?? [], ...anchors.slice(2)];
    groups[index] = next;
    // Trim trailing empty groups so "cleared everything" round-trips to [].
    while (groups.length > 0 && groups[groups.length - 1].length === 0) {
      groups.pop();
    }
    onChange(groups);
  }

  return (
    <section className="space-y-3 border border-border bg-card/50 p-4">
      <div className="space-y-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
          Anchor groups — free headline filter
        </span>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          A headline is accepted only if it contains at least one word from
          group 1 AND one from group 2 (word-boundary match, so
          &ldquo;Warsaw&rdquo; ≠ &ldquo;war&rdquo;). Costs nothing to run.
          {topicType === "topic" &&
            " Also builds the GDELT search: only articles whose full text hits both groups are fetched at all."}
          {" "}Headlines that hit one group go to the nightly LLM judge instead
          of being dropped outright.
        </p>
        {!enabled && (
          <p className="font-mono text-[10px] text-amber-500">
            Empty = gate off. Without groups this topic accepts everything the
            sources return whenever LLM stages are down or over budget.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChipList
          label="Group 1 — who / where"
          items={groupOne}
          maxItems={40}
          helpText="Words unique to this topic: places, actors, names (ukraine, kyiv, zelensky…). This group carries the precision — keep it specific."
          placeholder="+ add subject word"
          onChange={(next) => setGroup(0, next)}
        />
        <ChipList
          label="Group 2 — what happens"
          items={groupTwo}
          maxItems={40}
          helpText="Action and domain vocabulary (war, missile, attack, ceasefire…). Generic words are fine here — precision comes from requiring both groups together."
          placeholder="+ add action word"
          onChange={(next) => setGroup(1, next)}
        />
      </div>
    </section>
  );
}

function TypeBadge({
  type,
  onToggle,
}: {
  type: TopicType;
  onToggle: (next: TopicType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(type === "brand" ? "topic" : "brand")}
      title="Click to toggle. Brand enforces entity gate via aliases; topic skips it."
      className={cn(
        "cursor-pointer border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
        type === "brand"
          ? "border-violet-900 bg-violet-950 text-violet-300 hover:border-violet-800"
          : "border-sky-900 bg-sky-950 text-sky-300 hover:border-sky-800",
      )}
    >
      type: {type}
    </button>
  );
}
