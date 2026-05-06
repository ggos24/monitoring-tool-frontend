"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { apiClient } from "@/lib/api";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";

export function SchedulerInfo() {
  const topicsQuery = useQuery({
    queryKey: ["topics"],
    queryFn: apiClient.topics,
  });

  const firstId = topicsQuery.data?.[0]?.id ?? null;

  const overviewQuery = useQuery({
    queryKey: ["overview", firstId],
    queryFn: () => apiClient.overview(firstId!),
    enabled: firstId !== null,
    staleTime: 30_000,
  });

  const seconds = overviewQuery.data?.schedule_interval_seconds;
  const isLoading =
    topicsQuery.isLoading || (firstId !== null && overviewQuery.isLoading);
  const error = topicsQuery.error || overviewQuery.error;

  return (
    <div className="bg-zinc-950 p-5">
      <KickerLabel>Collection schedule</KickerLabel>

      <div className="mt-3">
        {isLoading ? (
          <Skeleton className="h-7 w-32 bg-zinc-900" />
        ) : error ? (
          <div className="font-mono text-[11px] text-zinc-500">
            Failed to load schedule.
          </div>
        ) : seconds === undefined ? (
          <div className="font-mono text-[11px] text-zinc-500">
            Awaiting first topic…
          </div>
        ) : (
          <span
            className="text-[20px] font-medium text-zinc-50 tabular-nums"
            style={{ letterSpacing: "-0.02em" }}
          >
            Every {formatInterval(seconds)}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
        <AlertTriangle
          className="mt-0.5 size-3.5 shrink-0 text-amber-400"
          aria-hidden
        />
        <span>
          Runtime change not supported — adjusting the interval requires a
          backend redeploy.
        </span>
      </div>
    </div>
  );
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const remMin = Math.round((seconds % 3600) / 60);
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
}
