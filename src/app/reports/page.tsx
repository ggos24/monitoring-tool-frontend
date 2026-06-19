"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { TopBar } from "@/components/dashboard/top-bar";
import { Footer } from "@/components/dashboard/footer";
import { DigestResultView, ReportDetail } from "@/components/reports/report-detail";
import { ReportList } from "@/components/reports/report-list";
import { GenerateReportForm } from "@/components/reports/generate-report-form";
import { ScheduledReports } from "@/components/reports/scheduled-reports";
import { ScopeSelector, type ReportScopeSel } from "@/components/reports/scope-selector";
import type { DigestResultDetail, SegmentCondition } from "@/lib/types";

// One Reports tab. Scope = a single TOPIC or a GROUP (union of topics).
// Generate-now → POST /api/reports/segment (ad-hoc, cached); scheduled
// digests stay per-topic. Group reports union + dedup + cluster across
// topics with framing as the headline axis.

// `useSearchParams` requires a Suspense boundary in Next 16 — wrap.
export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsInner />
    </Suspense>
  );
}

function ReportsInner() {
  const search = useSearchParams();
  const router = useRouter();

  const topicId = parseId(search.get("topic_id"));
  const groupId = parseId(search.get("group_id"));
  const scope: ReportScopeSel | null =
    groupId !== null
      ? { kind: "group", id: groupId }
      : topicId !== null
        ? { kind: "topic", id: topicId }
        : null;
  const reportId = parseInt(search.get("report_id") ?? "", 10) || null;

  // Selected scheduled-run — kept in state (no single-result GET on the
  // backend; the object comes from the run-history list's query cache).
  const [selectedRun, setSelectedRun] = useState<DigestResultDetail | null>(
    null,
  );

  const scopeParam = () =>
    scope ? `${scope.kind === "group" ? "group_id" : "topic_id"}=${scope.id}` : "";

  const setScope = (next: ReportScopeSel) => {
    setSelectedRun(null);
    const key = next.kind === "group" ? "group_id" : "topic_id";
    router.replace(`/reports?${key}=${next.id}`);
  };

  const selectReport = (newId: number) => {
    const parts = [scopeParam(), `report_id=${newId}`].filter(Boolean);
    setSelectedRun(null);
    router.replace(`/reports?${parts.join("&")}`);
  };

  const selectRun = (run: DigestResultDetail) => {
    setSelectedRun(run);
    router.replace(`/reports?${scopeParam()}`);
  };

  const prefillFilters = parseFiltersFromSearch(search);
  const prefillFrom = search.get("date_from");
  const prefillTo = search.get("date_to");

  return (
    <>
      <TopBar
        scope={
          scope === null
            ? null
            : scope.kind === "group"
              ? { group_id: scope.id }
              : { topic_id: scope.id }
        }
      />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ScopeSelector value={scope} onChange={setScope} />
          <h1 className="font-mono text-xs uppercase text-text-tertiary">
            Reports
          </h1>
        </div>

        {scope === null ? (
          <div className="border border-dashed border-border p-12 text-center text-sm text-text-tertiary">
            Select a topic or group to view or generate reports.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
              <GenerateReportForm
                scope={scope}
                prefillFilters={prefillFilters}
                prefillDateFrom={prefillFrom}
                prefillDateTo={prefillTo}
                onCreated={selectReport}
              />
              <section>
                <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
                  Recent
                </h2>
                <ReportList scope={scope} selectedId={reportId} />
              </section>
              {scope.kind === "topic" && (
                <ScheduledReports
                  topicId={scope.id}
                  selectedResultId={selectedRun?.id ?? null}
                  onSelectResult={selectRun}
                />
              )}
            </aside>
            <section className="lg:col-span-8 xl:col-span-9">
              {selectedRun !== null ? (
                <DigestResultView result={selectedRun} />
              ) : reportId !== null ? (
                <ReportDetail reportId={reportId} />
              ) : (
                <div className="border border-dashed border-border p-12 text-center text-sm text-text-tertiary">
                  Pick a report, a scheduled run, or generate a new one.
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function parseId(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseFiltersFromSearch(search: URLSearchParams): SegmentCondition[] {
  const out: SegmentCondition[] = [];
  const country = search.get("country_iso2");
  if (country) {
    out.push({ field: "country", op: "=", value: country });
  }
  const stance = search.get("stance_label");
  if (stance) {
    out.push({ field: "stance_label", op: "=", value: stance });
  }
  const quality = search.get("score_band");
  if (quality === "trusted") {
    out.push({ field: "source_score", op: ">=", value: 3 });
    out.push({ field: "is_propaganda", op: "=", value: false });
  } else if (quality === "propaganda") {
    out.push({ field: "is_propaganda", op: "=", value: true });
  }
  return out;
}
