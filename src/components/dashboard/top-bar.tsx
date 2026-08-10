"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";

import { apiClient } from "@/lib/api";
import type { ScopeParam } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  routable?: boolean;
  info?: boolean;
  preserveScope?: boolean;
};

const PRIMARY_NAV: NavItem[] = [
  { label: "Overview", href: "/", routable: true },
  { label: "Reports", href: "/reports", routable: true, preserveScope: true },
  { label: "Narratives", href: "/narratives", routable: true, preserveScope: true },
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
  const settingsActive =
    pathname === "/sources" || pathname.startsWith("/settings");

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto grid h-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-4 md:px-5">
        <div className="flex items-center gap-2">
          <div className="size-2 bg-success" aria-hidden />
          <span className="font-mono text-sm text-foreground">u24-pulse</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((item) => {
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
              <Link
                key={item.label}
                href={item.preserveScope ? scopedHref(item.href, scope) : item.href}
                className={className}
              >
                {inner}
              </Link>
            ) : (
              <a key={item.label} href={item.href} className={className}>
                {inner}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center justify-self-end font-mono text-[11px] text-text-tertiary">
          <div className="flex items-center gap-2 px-2 sm:px-3">
            <span
              className="inline-block size-1.5 animate-pulse bg-success"
              aria-hidden
            />
            <span className="hidden lg:inline">{status}</span>
          </div>
          <Link
            href="/settings"
            aria-current={settingsActive ? "page" : undefined}
            aria-label="Settings"
            title="Settings"
            className={cn(
              "flex h-8 items-center gap-1.5 border-l border-border px-2.5 transition-colors sm:px-3",
              settingsActive
                ? "bg-elevated text-foreground"
                : "text-text-tertiary hover:text-foreground",
            )}
          >
            <Settings2 className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function scopedHref(pathname: string, scope: ScopeParam | null) {
  if (scope === null) return pathname;
  if (typeof scope === "number") {
    return { pathname, query: { topic_id: String(scope) } };
  }
  if ("group_id" in scope) {
    return { pathname, query: { group_id: String(scope.group_id) } };
  }
  return { pathname, query: { topic_id: String(scope.topic_id) } };
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
