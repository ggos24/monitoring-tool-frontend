"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { TopBar } from "@/components/dashboard/top-bar";
import { Footer } from "@/components/dashboard/footer";
import { TopicSelector } from "@/components/dashboard/topic-selector";
import { DigestResultView, ReportDetail } from "@/components/reports/report-detail";
import { ReportList } from "@/components/reports/report-list";
import { GenerateReportForm } from "@/components/reports/generate-report-form";
import { ScheduledReports } from "@/components/reports/scheduled-reports";
import type { DigestResultDetail, SegmentCondition } from "@/lib/types";

// One Reports tab, two trigger modes of the same backend engine:
// - "Generate now"        → POST /api/reports/segment   (ad-hoc, cached)
// - "Save as scheduled"   → digest_definition rows      (nightly cron)
// Scheduled runs (digest_result) render in the same detail pane via the
// shared ReportBody — one component for both surfaces.

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

  const topicId = parseTopicId(search.get("topic_id"));
  const reportId = parseInt(search.get("report_id") ?? "", 10) || null;

  // Selected scheduled-run — kept in state (no single-result GET on the
  // backend; the object comes from the run-history list's query cache).
  const [selectedRun, setSelectedRun] = useState<DigestResultDetail | null>(
    null,
  );

  const setTopicId = (id: number | null) => {
    const params = new URLSearchParams();
    if (id !== null) params.set("topic_id", String(id));
    setSelectedRun(null);
    router.replace(`/reports?${params.toString()}`);
  };

  const selectReport = (newId: number) => {
    const params = new URLSearchParams();
    if (topicId !== null) params.set("topic_id", String(topicId));
    params.set("report_id", String(newId));
    setSelectedRun(null);
    router.replace(`/reports?${params.toString()}`);
  };

  const selectRun = (run: DigestResultDetail) => {
    // Clear ad-hoc selection from the URL so back/forward stays sane.
    const params = new URLSearchParams();
    if (topicId !== null) params.set("topic_id", String(topicId));
    setSelectedRun(run);
    router.replace(`/reports?${params.toString()}`);
  };

  const prefillFilters = parseFiltersFromSearch(search);
  const prefillFrom = search.get("date_from");
  const prefillTo = search.get("date_to");

  return (
    <>
      <TopBar topicId={topicId} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TopicSelector value={topicId} onChange={setTopicId} />
          <h1 className="font-mono text-xs uppercase text-text-tertiary">
            Reports
          </h1>
        </div>

        {topicId === null ? (
          <div className="border border-dashed border-border p-12 text-center text-sm text-text-tertiary">
            Select a topic to view or generate reports.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
              <GenerateReportForm
                topicId={topicId}
                prefillFilters={prefillFilters}
                prefillDateFrom={prefillFrom}
                prefillDateTo={prefillTo}
                onCreated={selectReport}
              />
              <section>
                <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
                  Recent
                </h2>
                <ReportList topicId={topicId} selectedId={reportId} />
              </section>
              <ScheduledReports
                topicId={topicId}
                selectedResultId={selectedRun?.id ?? null}
                onSelectResult={selectRun}
              />
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

function parseTopicId(raw: string | null): number | null {
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
