"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import type { SourceFilter } from "@/components/dashboard/mentions-list";
import type { ScopeParam } from "@/lib/types";
import type { DateWindow } from "@/lib/period";
import { toLocalInput } from "@/lib/dashboard-filters";
import { CONTROL } from "./toolbar";

// Forwards the dashboard's current scope + filter state to the Reports
// page via URL query params (topic_id OR group_id). The /reports page
// parses these and seeds the GenerateReportForm.
//
// Date range = the dashboard's current window (preset or custom range).
export function GenerateReportLink({
  scope,
  win,
  country,
  source,
}: {
  scope: ScopeParam | null;
  win: DateWindow;
  country: string | null;
  source: SourceFilter;
}) {
  if (scope === null) return null;

  // The report form's datetime-local inputs are in the browser's zone.
  const dateFrom = new Date(win.from);
  const dateTo = new Date(win.to);

  const params = new URLSearchParams();
  if (typeof scope === "number") params.set("topic_id", String(scope));
  else if ("group_id" in scope) params.set("group_id", String(scope.group_id));
  else params.set("topic_id", String(scope.topic_id));
  params.set("date_from", toLocalInput(dateFrom));
  params.set("date_to", toLocalInput(dateTo));
  if (country) params.set("country_iso2", country);
  if (source !== "all") params.set("source", source);

  return (
    <Link
      href={`/reports?${params.toString()}`}
      className={CONTROL}
      title="Generate a report from the current filters"
    >
      <FileText className="size-3.5" />
      <span>Generate report</span>
    </Link>
  );
}
