"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import { TopicRow } from "./topic-row";

export function TopicsEditor() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["topics"],
    queryFn: apiClient.topics,
  });

  return (
    <section className="bg-zinc-950 p-5">
      <KickerLabel>Topics</KickerLabel>
      <p className="mt-1 mb-4 text-xs text-zinc-500">
        Edit name, search query, or toggle active. Backend re-sync runs on the
        next collection cycle.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-zinc-900" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
          <span>Failed to load topics</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="cursor-pointer border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-300 hover:border-zinc-700 hover:text-zinc-50"
          >
            retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="font-mono text-[11px] text-zinc-500">
          No topics configured. Creating topics from UI is not yet supported.
        </div>
      ) : (
        <ul>
          {data.map((topic) => (
            <TopicRow key={topic.id} topic={topic} />
          ))}
        </ul>
      )}
    </section>
  );
}
