"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { formatAgo, formatEvery, plural } from "@/lib/narrative-rules";
import type { NarrativePool, NarrativesResponse } from "@/lib/types";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";

import { NarrativeCard } from "./narrative-card";

// Fallback when the pool row is missing (2h, app/scheduler.py).
const DEFAULT_INTERVAL_SECONDS = 7200;

// Settings → Narratives. Read-only explanation of what a narrative is and
// which rule lets an article in, plus the two safe controls per narrative
// (rename, pause/resume). Rules themselves are never edited here.
export function NarrativesPanel() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["narratives"],
    queryFn: apiClient.narratives,
  });

  const interval = data?.pool?.schedule_interval_seconds ?? DEFAULT_INTERVAL_SECONDS;

  // /settings#narrative-{id} (the old rule-editor link redirects here):
  // the cards render after the fetch, so scroll once they exist. Only once:
  // a refetch (after rename/pause, or on window focus) must not jump back.
  const scrolledToHash = useRef(false);
  useEffect(() => {
    if (!data || scrolledToHash.current) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#narrative-")) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    scrolledToHash.current = true;
  }, [data]);

  return (
    <div className="space-y-6">
      <Explainer interval={interval} />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full bg-elevated" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full bg-elevated" />
          ))}
        </div>
      ) : error || !data ? (
        <div className="flex items-center gap-3 bg-card p-5 font-mono text-[11px] text-text-tertiary">
          <span>Could not load queries.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="cursor-pointer border border-border bg-elevated px-2 py-0.5 text-text-secondary hover:border-strong hover:text-foreground"
          >
            Retry
          </button>
        </div>
      ) : (
        <Body data={data} interval={interval} />
      )}
    </div>
  );
}

function Explainer({ interval }: { interval: number }) {
  const every = formatEvery(interval);
  return (
    <section className="bg-card p-5">
      <KickerLabel>Queries</KickerLabel>
      <div className="mt-3 max-w-3xl space-y-3 text-xs leading-relaxed text-text-secondary">
        <p>
          A query is a filter over the Tier-1 pool. Every {every} we collect new articles
          from about 95 Tier-1 outlets. Each collecting query then checks every new
          article and keeps the ones that fit its rules.
        </p>
        <div>
          <p className="text-foreground">How an article gets in:</p>
          <ol className="mt-1.5 space-y-1">
            <li>
              <span className="font-mono text-[11px] text-text-tertiary">1.</span> Never, if the
              headline or text contains an excluded word.
            </li>
            <li>
              <span className="font-mono text-[11px] text-text-tertiary">2.</span> Yes, if the
              headline contains one of the query&rsquo;s key phrases.
            </li>
            <li>
              <span className="font-mono text-[11px] text-text-tertiary">3.</span> Otherwise,
              only if the text mentions at least one word from EVERY word group.
            </li>
          </ol>
          <p className="mt-1.5 text-text-tertiary">
            Most Tier-1 articles reach us as a headline only, so in practice the headline
            decides. Each card below lists its exact words.
          </p>
        </div>
        <p>
          Rules are kept in reviewed files, not edited here. When the team changes a
          query&rsquo;s rules, they also re-check the older pool articles, so old and
          new articles follow the same rules.
        </p>
        <p>
          Here you can rename a query or pause and resume it. Renaming changes only the
          display name.
        </p>
      </div>
    </section>
  );
}

function Body({ data, interval }: { data: NarrativesResponse; interval: number }) {
  const active = data.narratives.filter((n) => n.is_active);
  const paused = data.narratives.filter((n) => !n.is_active);
  const inCampaign = data.narratives.filter((n) => n.in_campaign_group);

  return (
    <>
      {data.pool && <PoolStrip pool={data.pool} />}

      <p className="text-xs text-text-tertiary">
        {inCampaign.length > 0 ? (
          <>
            All queries on the dashboard = the Campaign group:{" "}
            <span className="text-text-secondary">
              {inCampaign.map((n) => n.name).join(", ")}
            </span>{" "}
            (managed with the rule files).
          </>
        ) : (
          <>No query is shown under All queries on the dashboard yet.</>
        )}
      </p>

      {data.narratives.length === 0 ? (
        <div className="bg-card p-5 font-mono text-[11px] text-text-tertiary">
          No queries yet.
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid gap-px bg-border">
              {active.map((n) => (
                <NarrativeCard key={n.topic_id} narrative={n} intervalSeconds={interval} />
              ))}
            </div>
          )}
          {paused.length > 0 && (
            <div>
              <KickerLabel className="mb-3">Paused</KickerLabel>
              <div className="grid gap-px bg-border">
                {paused.map((n) => (
                  <NarrativeCard key={n.topic_id} narrative={n} intervalSeconds={interval} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function PoolStrip({ pool }: { pool: NarrativePool }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border border-border bg-card px-4 py-3 font-mono text-[11px] text-text-tertiary tabular-nums">
      <span
        aria-hidden
        className={pool.is_active ? "size-1.5 bg-success" : "size-1.5 bg-strong"}
      />
      <span className="text-text-secondary">Tier-1 pool</span>
      <span>·</span>
      <span>
        {pool.is_active
          ? `collecting every ${formatEvery(pool.schedule_interval_seconds)}`
          : "paused"}
      </span>
      <span>·</span>
      <span>{plural(pool.mentions_count, "article", "articles")}</span>
      <span>·</span>
      <span>last added {formatAgo(pool.last_added_at)}</span>
      <span>·</span>
      <span>{pool.is_active ? "always on" : "off"} (managed by the team)</span>
    </div>
  );
}
