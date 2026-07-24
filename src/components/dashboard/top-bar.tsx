"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  routable?: boolean;
  info?: boolean;
};

const NAV: NavItem[] = [
  { label: "Overview", href: "/", routable: true },
  // "Mentions" is hidden for now — the standalone mentions view isn't in
  // use yet. Kept here (commented) so it can be restored without rework.
  // { label: "Mentions", href: "#" },
  { label: "Sources", href: "/sources", routable: true },
  { label: "Reports", href: "/reports", routable: true },
  { label: "Settings", href: "/settings", routable: true },
];

export function TopBar({ scope }: { scope: ScopeParam | null }) {
  const pathname = usePathname();

  const { data, isLoading, error } = useQuery({
    queryKey: ["overview", scope],
    queryFn: () => apiClient.overview(scope!),
    enabled: scope !== null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const now = useTickingNow(1000);

  const status = renderStatus({
    enabled: scope !== null,
    isLoading,
    hasError: !!error,
    lastSyncAt: data?.last_sync_at ?? null,
    nextSyncAt: data?.next_sync_estimate ?? null,
    now,
  });

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <div className="size-2 bg-success" aria-hidden />
          <span className="font-mono text-sm text-foreground">u24-pulse</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const isActive = item.routable && pathname === item.href;
            const className = cn(
              "px-3 py-1.5 font-mono text-xs transition-colors",
              item.routable ? "cursor-pointer" : "cursor-default",
              isActive
                ? "bg-elevated text-foreground"
                : "text-text-tertiary hover:text-foreground",
            );
            const inner = (
              <>
                {item.label}
                {item.info && <span className="ml-1 text-muted-foreground">ⓘ</span>}
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

        <div className="flex items-center gap-2 font-mono text-[11px] text-text-tertiary">
          <span
            className="inline-block size-1.5 animate-pulse bg-success"
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
  nextSyncAt,
  now,
}: {
  enabled: boolean;
  isLoading: boolean;
  hasError: boolean;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  now: number;
}): string {
  if (!enabled || isLoading) return "Live · …";
  if (hasError || !lastSyncAt) return "Awaiting first sync…";
  const last = `last sync ${formatAgo(lastSyncAt, now)}`;
  if (!nextSyncAt) return `Live · ${last}`;
  const target = new Date(nextSyncAt).getTime();
  if (Number.isNaN(target)) return `Live · ${last}`;
  return `Live · ${last} · next ${formatCountdown(target - now)}`;
}

function formatAgo(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return "syncing soon…";
  const totalSec = Math.floor(diffMs / 1000);
  const hr = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const ss = String(sec).padStart(2, "0");
  if (hr > 0) return `in ${hr}h ${String(min).padStart(2, "0")}m ${ss}s`;
  if (min > 0) return `in ${min}m ${ss}s`;
  return `in ${sec}s`;
}

function useTickingNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
