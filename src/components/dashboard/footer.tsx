"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";

export function Footer({ brandId }: { brandId: number | null }) {
  const { data } = useQuery({
    queryKey: ["overview", brandId],
    queryFn: () => apiClient.overview(brandId!),
    enabled: brandId !== null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const sourcesText =
    data?.total_sources !== undefined
      ? `${data.total_sources} sources`
      : "— sources";

  const nextSyncText = renderNextSync(data?.next_sync_estimate ?? null);

  return (
    <footer className="border-t border-zinc-900 py-[18px]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-x-2 px-5 font-mono text-[11px] text-zinc-700">
        <span>u24-pulse v0.1</span>
        <span aria-hidden>·</span>
        <span>{sourcesText}</span>
        <span aria-hidden>·</span>
        <span>{nextSyncText}</span>
        <span aria-hidden>·</span>
        <a
          href="https://web-production-c3b4.up.railway.app/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer transition-colors hover:text-zinc-500"
        >
          API docs ↗
        </a>
      </div>
    </footer>
  );
}

function renderNextSync(iso: string | null): string {
  if (!iso) return "Awaiting first sync…";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "Awaiting first sync…";
  const diffMs = target - Date.now();
  if (diffMs <= 0) return "Syncing soon…";
  return `Next sync ${formatIn(diffMs)}`;
}

function formatIn(diffMs: number): string {
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "in <1m";
  if (min < 60) return `in ${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin === 0 ? `in ${hr}h` : `in ${hr}h ${remMin}m`;
}
