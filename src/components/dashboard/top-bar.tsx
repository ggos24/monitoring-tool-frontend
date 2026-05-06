"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  routable?: boolean;
  info?: boolean;
};

const NAV: NavItem[] = [
  { label: "Overview", href: "/", routable: true },
  { label: "Mentions", href: "#" },
  { label: "Sources", href: "#" },
  { label: "Insights", href: "#", info: true },
  { label: "Settings", href: "/settings", routable: true },
];

export function TopBar({ topicId }: { topicId: number | null }) {
  const pathname = usePathname();

  const { data, isLoading, error } = useQuery({
    queryKey: ["overview", topicId],
    queryFn: () => apiClient.overview(topicId!),
    enabled: topicId !== null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const status = renderStatus({
    enabled: topicId !== null,
    isLoading,
    hasError: !!error,
    lastSyncAt: data?.last_sync_at ?? null,
  });

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-zinc-800 bg-black/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <div className="size-2 bg-emerald-400" aria-hidden />
          <span className="font-mono text-sm text-zinc-50">u24-pulse</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const isActive = item.routable && pathname === item.href;
            const className = cn(
              "px-3 py-1.5 font-mono text-xs transition-colors",
              item.routable ? "cursor-pointer" : "cursor-default",
              isActive
                ? "bg-zinc-900 text-zinc-50"
                : "text-zinc-600 hover:text-zinc-300",
            );
            const inner = (
              <>
                {item.label}
                {item.info && <span className="ml-1 text-zinc-700">ⓘ</span>}
              </>
            );
            return item.routable ? (
              <Link key={item.label} href={item.href} className={className}>
                {inner}
              </Link>
            ) : (
              <a key={item.label} href={item.href} className={className}>
                {inner}
              </a>
            );
          })}
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
