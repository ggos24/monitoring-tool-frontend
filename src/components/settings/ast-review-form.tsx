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
      <header className="space-y-2 border-b border-zinc-800 pb-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-mono text-base text-zinc-50">
            {ast.canonical_name}
          </h2>
          <TypeBadge
            type={ast.type}
            onToggle={(next) => setEdited({ ...ast, type: next })}
          />
          <span
            className={cn(
              "ml-auto font-mono text-[11px]",
              origin.is_active ? "text-emerald-400" : "text-zinc-500",
            )}
          >
            {origin.is_active ? "● Active" : "○ Inactive"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
            Wikidata
          </span>
          {ast.wikidata_qids.length === 0 ? (
            <span className="font-mono text-[11px] text-zinc-600">(none)</span>
          ) : (
            ast.wikidata_qids.map((qid) =>
              QID_RE.test(qid) ? (
                <a
                  key={qid}
                  href={`https://www.wikidata.org/wiki/${qid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-sky-300 hover:border-sky-800"
                >
                  {qid}
                </a>
              ) : (
                <span
                  key={qid}
                  className="border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500"
                  title="Not a valid QID format"
                >
                  {qid}
                </span>
              ),
            )
          )}
        </div>
        <p className="font-mono text-[10px] text-zinc-600">
          anchor_embedding_version: {origin.anchor_embedding_version}{" "}
          {origin.anchor_embedded ? "✓" : "(embed failed — operator should retry)"}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChipList
          label="Core terms"
          items={ast.terms.core}
          maxItems={10}
          helpText="Single tokens matched with word boundaries. Case-insensitive."
          placeholder="+ add core term"
          onChange={(next) =>
            setEdited({ ...ast, terms: { ...ast.terms, core: next } })
          }
        />
        <ChipList
          label="Context"
          items={ast.terms.context}
          maxItems={10}
          helpText="Multi-word descriptors that disambiguate the topic."
          placeholder="+ add context"
          onChange={(next) =>
            setEdited({ ...ast, terms: { ...ast.terms, context: next } })
          }
        />
        <ChipList
          label="Phrases"
          items={ast.terms.phrases}
          maxItems={10}
          helpText="Exact phrases (quoted in queries)."
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

      <ChipList
        label="Exclude these (must_not_co_occur)"
        items={ast.must_not_co_occur}
        maxItems={20}
        helpText="Drop matches containing these phrases — used to filter false-positive senses."
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
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
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
            "block w-full border border-zinc-800 bg-zinc-950 px-3 py-2",
            "font-mono text-[12px] leading-relaxed text-zinc-100",
            "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
          )}
        />
        <p className="font-mono text-[10px] text-zinc-600">
          2–3 sentences describing what the topic is &ldquo;about&rdquo;.
          Embedded by Gemini and used as the cosine-similarity reference for
          borderline mentions. {ast.anchor_text.length}/2000 chars
          {ast.anchor_text.length < 10 && (
            <span className="ml-1 text-red-400">(min 10)</span>
          )}
        </p>
      </section>

      <ProvenancePanel provenance={origin.topic_ast.provenance} />

      <footer className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950 px-5 py-3">
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
            <span className="text-zinc-600">No changes</span>
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
                ? "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-700"
                : "cursor-pointer border-zinc-700 bg-zinc-50 text-black hover:bg-zinc-200",
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
                  ? "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-700"
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
