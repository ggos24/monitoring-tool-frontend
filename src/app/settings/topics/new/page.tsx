"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TopicCreateOut } from "@/lib/types";

import { Footer } from "@/components/dashboard/footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { AstReviewForm } from "@/components/settings/ast-review-form";
import { DraftingProgress } from "@/components/settings/drafting-progress";
import { KickerLabel } from "@/components/ui/kicker-label";

export default function NewTopicPage() {
  const [phrase, setPhrase] = useState("");
  const [draft, setDraft] = useState<TopicCreateOut | null>(null);

  const mutation = useMutation({
    mutationFn: (p: string) => apiClient.createTopic(p),
    onSuccess: (response) => setDraft(response),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phrase.trim();
    if (!trimmed) return;
    setDraft(null);
    mutation.mutate(trimmed);
  }

  function handleRetry() {
    mutation.reset();
    setDraft(null);
  }

  const inputDisabled = mutation.isPending || draft !== null;

  return (
    <>
      <TopBar topicId={null} />
      <main className="mx-auto w-full max-w-[1080px] flex-1 space-y-6 px-5 py-6">
        <header className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-zinc-50">
              New topic
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              Type a phrase. Gemini drafts a structured profile (synonyms,
              exclusions, semantic anchor); DataForSEO validates search
              volumes. Review and edit before activating.
            </p>
          </div>
          <Link
            href="/settings"
            className="font-mono text-[11px] text-zinc-500 hover:text-zinc-200"
          >
            ← back to settings
          </Link>
        </header>

        {!draft && (
          <section className="bg-zinc-950 p-5">
            <KickerLabel>Track what?</KickerLabel>
            <form
              onSubmit={handleSubmit}
              className="mt-3 flex flex-wrap items-center gap-2"
            >
              <input
                type="text"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                disabled={inputDisabled}
                placeholder="e.g. openai, zelensky, NATO summit"
                maxLength={255}
                className={cn(
                  "h-9 min-w-[260px] flex-1 border border-zinc-800 bg-zinc-950 px-2",
                  "font-mono text-sm text-zinc-50 placeholder:text-zinc-700",
                  "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
                  inputDisabled && "cursor-not-allowed opacity-60",
                )}
              />
              <button
                type="submit"
                disabled={inputDisabled || phrase.trim().length === 0}
                className={cn(
                  "h-9 border px-4 font-mono text-[11px] transition-colors",
                  inputDisabled || phrase.trim().length === 0
                    ? "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-700"
                    : "cursor-pointer border-zinc-700 bg-zinc-50 text-black hover:bg-zinc-200",
                )}
              >
                {mutation.isPending ? "Creating…" : "Create topic"}
              </button>
            </form>
            <p className="mt-2 font-mono text-[10px] text-zinc-600">
              Topics created here start as <span className="text-zinc-400">Inactive</span>.
              Review the draft, edit chips/exclusions, then click Activate.
            </p>
          </section>
        )}

        {mutation.isPending && !draft && (
          <DraftingProgress phrase={phrase.trim()} />
        )}

        {mutation.isError && !draft && (
          <ErrorBanner
            error={mutation.error}
            onRetry={handleRetry}
            phrase={phrase.trim()}
          />
        )}

        {draft && (
          <section className="bg-zinc-950 p-5">
            <KickerLabel>Review &amp; edit</KickerLabel>
            <p className="mt-1 mb-5 text-xs text-zinc-500">
              Topic created (id {draft.id}, inactive). Add or remove chips,
              tune the anchor, then save or activate.
            </p>
            <AstReviewForm initial={draft} />
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

function ErrorBanner({
  error,
  onRetry,
  phrase,
}: {
  error: unknown;
  onRetry: () => void;
  phrase: string;
}) {
  let title = "Failed to create topic";
  let detail = "Unknown error. Try again.";

  if (error instanceof ApiError) {
    detail = error.message;
    if (error.status === 400) {
      title = "Validation error";
    } else if (error.status === 401) {
      title = "Config error";
      detail =
        "Admin key rejected by backend. Contact the operator who set up ADMIN_API_KEY.";
    } else if (error.status === 500 && /gemini/i.test(error.message)) {
      title = "Gemini drafter failed";
      detail =
        "The Gemini API was unreachable or returned an error. This is usually transient — try again.";
    } else if (error.status === 502) {
      title = "Malformed AST from Gemini";
      detail =
        "Gemini returned output that doesn't satisfy the schema. Rare — retry, and tell the operator if it persists.";
    } else if (error.status === 503) {
      title = "Admin endpoint not configured";
      detail =
        "Backend says ADMIN_API_KEY is empty on its side. Contact the operator.";
    }
  }

  return (
    <div className="border border-red-900 bg-red-950/30 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-red-300">
        {title}
      </p>
      <p className="mt-1 font-mono text-[12px] text-red-100">{detail}</p>
      {phrase && (
        <p className="mt-2 font-mono text-[10px] text-zinc-500">
          Phrase: <span className="text-zinc-300">{phrase}</span>
        </p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 cursor-pointer border border-red-900 bg-red-950/50 px-3 py-1 font-mono text-[11px] text-red-100 hover:border-red-800"
      >
        Retry
      </button>
    </div>
  );
}
