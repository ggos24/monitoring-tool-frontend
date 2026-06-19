"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import type { QualityFilter, SourceFilter } from "@/components/dashboard/mentions-list";
import type { ScopeParam } from "@/lib/types";

// Forwards the dashboard's current scope + filter state to the Reports
// page via URL query params (topic_id OR group_id). The /reports page
// parses these and seeds the GenerateReportForm.
//
// Date range is derived from `days` against now() — same convention
// the rest of the dashboard uses for its rolling window.
export function GenerateReportLink({
  scope,
  days,
  country,
  source,
  quality,
}: {
  scope: ScopeParam | null;
  days: number;
  country: string | null;
  source: SourceFilter;
  quality: QualityFilter;
}) {
  if (scope === null) return null;

  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams();
  if (typeof scope === "number") params.set("topic_id", String(scope));
  else if ("group_id" in scope) params.set("group_id", String(scope.group_id));
  else params.set("topic_id", String(scope.topic_id));
  params.set("date_from", dateFrom.toISOString().slice(0, 16));
  params.set("date_to", dateTo.toISOString().slice(0, 16));
  if (country) params.set("country_iso2", country);
  if (source !== "all") params.set("source", source);
  if (quality !== "all") params.set("score_band", quality);

  return (
    <Link
      href={`/reports?${params.toString()}`}
      className="flex items-center gap-1 border border-border bg-card px-3 py-1.5 font-mono text-xs text-text-secondary hover:bg-muted transition-colors"
      title="Generate a narrative report from the current filters"
    >
      <FileText className="size-3" />
      <span>Generate report</span>
    </Link>
  );
}
