"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { apiClient } from "@/lib/api";
import type { Report } from "@/lib/types";
import type { ReportScopeSel } from "@/components/reports/scope-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ReportList({
  scope,
  selectedId,
}: {
  scope: ReportScopeSel;
  selectedId: number | null;
}) {
  const scopeQuery =
    scope.kind === "group" ? { group_id: scope.id } : { topic_id: scope.id };
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", scope.kind, scope.id],
    queryFn: () => apiClient.listReports(scopeQuery, 20),
    enabled: scope.id > 0,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (error)
    return (
      <p className="text-xs text-destructive">
        Failed to load reports: {(error as Error).message}
      </p>
    );
  if (!data || data.length === 0)
    return (
      <p className="text-xs text-text-tertiary">
        No reports yet for this {scope.kind} — generate one below.
      </p>
    );

  const scopeQ =
    scope.kind === "group"
      ? { group_id: scope.id }
      : { topic_id: scope.id };

  return (
    <ul className="flex flex-col">
      {data.map((r) => (
        <li key={r.id}>
          <Link
            href={{
              pathname: "/reports",
              query: { ...scopeQ, report_id: r.id },
            }}
            className={cn(
              "block border border-border border-b-0 last:border-b bg-card p-3 hover:bg-muted transition-colors",
              selectedId === r.id && "border-l-2 border-l-foreground bg-muted",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-foreground">
                #{r.id}
              </span>
              <StatusBadge status={r.status} cached={r.cached} />
            </div>
            <div className="mt-1 font-mono text-[11px] text-text-tertiary">
              {r.n_mentions ?? 0} mentions · {summariseFilters(r.params)}
            </div>
            <div className="font-mono text-[10px] text-text-tertiary">
              {new Date(r.created_at).toLocaleString()}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({
  status,
  cached,
}: {
  status: Report["status"];
  cached?: boolean;
}) {
  if (cached) {
    return (
      <span className="font-mono text-[10px] uppercase text-text-tertiary">
        cached
      </span>
    );
  }
  const klass = {
    pending: "text-text-tertiary",
    running: "text-text-tertiary animate-pulse",
    success: "text-success",
    failed: "text-destructive",
  }[status];
  return (
    <span className={cn("font-mono text-[10px] uppercase", klass)}>
      {status}
    </span>
  );
}

function summariseFilters(params: Record<string, unknown>): string {
  const filters = Array.isArray(params.filters) ? params.filters : [];
  if (filters.length === 0) return "no filters";
  return (filters as Array<Record<string, unknown>>)
    .map((c) => `${c.field}${c.op}${JSON.stringify(c.value)}`)
    .slice(0, 3)
    .join(" · ");
}
