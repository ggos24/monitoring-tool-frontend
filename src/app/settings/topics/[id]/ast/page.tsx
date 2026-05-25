"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { Topic, TopicCreateOut } from "@/lib/types";

import { Footer } from "@/components/dashboard/footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { AstReviewForm } from "@/components/settings/ast-review-form";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function EditTopicAstPage({ params }: PageProps) {
  const { id } = use(params);
  const topicId = Number(id);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["topics"],
    queryFn: apiClient.topics,
  });

  return (
    <>
      <TopBar topicId={null} />
      <main className="mx-auto w-full max-w-[1080px] flex-1 space-y-6 px-5 py-6">
        <header className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-foreground">
              Edit topic AST
            </h1>
            <p className="mt-1 text-xs text-text-tertiary">
              Edit the structured profile. Top-level fields are replaced on
              save. Anchor edits trigger re-embedding.
            </p>
          </div>
          <Link
            href="/settings"
            className="font-mono text-[11px] text-text-tertiary hover:text-foreground"
          >
            ← back to settings
          </Link>
        </header>

        {Number.isNaN(topicId) ? (
          <NotFound message={`Invalid topic id: ${id}`} />
        ) : isLoading ? (
          <Skeleton className="h-96 w-full bg-elevated" />
        ) : error ? (
          <div className="border border-red-900 bg-red-950/30 p-4">
            <p className="font-mono text-[12px] text-red-100">
              Failed to load topic.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 cursor-pointer border border-red-900 bg-red-950/50 px-3 py-1 font-mono text-[11px] text-red-100 hover:border-red-800"
            >
              Retry
            </button>
          </div>
        ) : (
          <Body topicId={topicId} topics={data ?? []} />
        )}
      </main>
      <Footer />
    </>
  );
}

function Body({ topicId, topics }: { topicId: number; topics: Topic[] }) {
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) {
    return <NotFound message={`Topic ${topicId} not found.`} />;
  }
  if (!topic.topic_ast) {
    return (
      <div className="border border-border bg-card p-5">
        <KickerLabel>No AST</KickerLabel>
        <p className="mt-2 font-mono text-[12px] text-text-secondary">
          This topic was created before semantic matching shipped and has no AST.
        </p>
        <p className="mt-1 font-mono text-[11px] text-text-tertiary">
          Use the inline edit row in{" "}
          <Link href="/settings" className="text-sky-300 hover:underline">
            Settings → Topics
          </Link>{" "}
          to change name/query, or recreate the topic via &ldquo;+ New topic&rdquo; to get an AST.
        </p>
      </div>
    );
  }

  // Reconstruct a TopicCreateOut shape from the GET /api/topics row.
  // GET response omits anchor_embedding_version + anchor_embedded — surface
  // sensible defaults so the form renders. (Save flow updates origin from
  // the PATCH response which DOES include them.)
  const initial: TopicCreateOut = {
    id: topic.id,
    name: topic.name,
    query: topic.query,
    queries: topic.queries,
    topic_ast: topic.topic_ast,
    anchor_embedding_version: "(loaded from GET — refresh on next save)",
    anchor_embedded: true,
    is_active: topic.is_active,
  };

  return (
    <section className="bg-card p-5">
      <KickerLabel>Review &amp; edit</KickerLabel>
      <p className="mt-1 mb-5 text-xs text-text-tertiary">
        Editing {topic.name} (id {topic.id}).
      </p>
      <AstReviewForm initial={initial} />
    </section>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="border border-border bg-card p-5">
      <p className="font-mono text-[12px] text-text-secondary">{message}</p>
      <Link
        href="/settings"
        className="mt-3 inline-block font-mono text-[11px] text-sky-300 hover:underline"
      >
        ← back to settings
      </Link>
    </div>
  );
}
