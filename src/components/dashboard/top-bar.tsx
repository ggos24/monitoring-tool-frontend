"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

type NavItem = { label: string; active?: boolean; info?: boolean };

const NAV: NavItem[] = [
  { label: "Overview", active: true },
  { label: "Mentions" },
  { label: "Sources" },
  { label: "Insights", info: true },
  { label: "Settings" },
];

export function TopBar({ brandId }: { brandId: number | null }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["overview", brandId],
    queryFn: () => apiClient.overview(brandId!),
    enabled: brandId !== null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const status = renderStatus({
    enabled: brandId !== null,
    isLoading,
    hasError: !!error,
    lastSyncAt: data?.last_sync_at ?? null,
  });

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-zinc-900 bg-black/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <div className="size-2 bg-emerald-400" aria-hidden />
          <span className="font-mono text-sm text-zinc-50">u24-pulse</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.label}
              href="#"
              className={cn(
                "cursor-default px-3 py-1.5 font-mono text-xs transition-colors",
                item.active
                  ? "bg-zinc-900 text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-300",
              )}
            >
              {item.label}
              {item.info && <span className="ml-1 text-zinc-700">ⓘ</span>}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-600">
          <span
            className="inline-block size-1.5 animate-pulse bg-emerald-400"
            aria-hidden
          />
          <span className="hidden sm:inline">{status}</span>
        </div>
      </div>
    </header>
  );
}

function renderStatus({
  enabled,
  isLoading,
  hasError,
  lastSyncAt,
}: {
  enabled: boolean;
  isLoading: boolean;
  hasError: boolean;
  lastSyncAt: string | null;
}): string {
  if (!enabled || isLoading) return "Live · …";
  if (hasError || !lastSyncAt) return "Awaiting first sync…";
  return `Live · last sync ${formatAgo(lastSyncAt)}`;
}

function formatAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "just now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
