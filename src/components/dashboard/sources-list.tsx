"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";

export function SourcesList({
  topicId,
  days,
}: {
  topicId: number | null;
  days: number;
}) {
  const enabled = topicId !== null;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sources", topicId, days, 10],
    queryFn: () => apiClient.topSources(topicId!, days, 10),
    enabled,
  });

  return (
    <div className="bg-zinc-950 p-5">
      <KickerLabel>Top sources</KickerLabel>
      <div className="mt-1 mb-4 text-xs text-zinc-400">
        Top 10 domains by mention count, last {days}d
      </div>

      {!enabled ? (
        <EmptyMessage>Select a topic to load sources</EmptyMessage>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full bg-zinc-900" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
          <span>Failed to load sources</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-300 hover:border-zinc-700 hover:text-zinc-50"
          >
            retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyMessage>No sources in selected period.</EmptyMessage>
      ) : (
        <>
          <ul className="space-y-3">
            {data.map((s) => (
              <SourceRow
                key={s.domain}
                domain={s.domain}
                count={s.count}
                max={data[0].count || 1}
              />
            ))}
          </ul>
          <div className="mt-5 border-t border-zinc-900 pt-3">
            <a
              href="#"
              className="cursor-default font-mono text-[11px] text-zinc-600 hover:text-zinc-400"
            >
              View all sources ↗
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function SourceRow({
  domain,
  count,
  max,
}: {
  domain: string;
  count: number;
  max: number;
}) {
  const pct = Math.max(2, Math.round((count / max) * 100));
  return (
    <li className="group cursor-default">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-xs text-zinc-300">{domain}</span>
        <span className="font-mono text-[11px] text-zinc-600 tabular-nums">
          {count}
        </span>
      </div>
      <div className="h-[3px] bg-zinc-900 group-hover:bg-zinc-800">
        <div
          className="h-full bg-zinc-700 transition-colors group-hover:bg-zinc-50"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] text-zinc-500">{children}</div>
  );
}
