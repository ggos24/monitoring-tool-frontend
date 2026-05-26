"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { TopBar } from "@/components/dashboard/top-bar";
import { Footer } from "@/components/dashboard/footer";
import { TopicSelector } from "@/components/dashboard/topic-selector";
import { ReportDetail } from "@/components/reports/report-detail";
import { ReportList } from "@/components/reports/report-list";
import { GenerateReportForm } from "@/components/reports/generate-report-form";
import { apiClient } from "@/lib/api";
import type { DigestDefinition, SegmentCondition } from "@/lib/types";

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

  const setTopicId = (id: number | null) => {
    const params = new URLSearchParams();
    if (id !== null) params.set("topic_id", String(id));
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
                onCreated={(newId) => {
                  const params = new URLSearchParams();
                  params.set("topic_id", String(topicId));
                  params.set("report_id", String(newId));
                  router.replace(`/reports?${params.toString()}`);
                }}
              />
              <section>
                <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
                  Recent
                </h2>
                <ReportList topicId={topicId} selectedId={reportId} />
              </section>
              <ScheduledDigestsPanel topicId={topicId} />
            </aside>
            <section className="lg:col-span-8 xl:col-span-9">
              {reportId !== null ? (
                <ReportDetail reportId={reportId} />
              ) : (
                <div className="border border-dashed border-border p-12 text-center text-sm text-text-tertiary">
                  Pick a report from the list or generate a new one.
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

function ScheduledDigestsPanel({ topicId }: { topicId: number }) {
  const { data } = useQuery({
    queryKey: ["digest-definitions", topicId, "active"],
    queryFn: () =>
      apiClient.digestDefinitions({ topic_id: topicId, active_only: true }),
    enabled: topicId > 0,
  });

  if (!data || data.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
        Scheduled digests
      </h2>
      <ul className="flex flex-col gap-1">
        {data.map((def: DigestDefinition) => (
          <li key={def.id}>
            <LatestDigestLink definition={def} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LatestDigestLink({ definition }: { definition: DigestDefinition }) {
  const { data, isLoading } = useQuery({
    queryKey: ["digest-latest", definition.id],
    queryFn: () => apiClient.latestDigestResult(definition.id),
    retry: false,
  });
  return (
    <div className="border border-border bg-card p-2 font-mono text-xs">
      <div className="text-foreground">{definition.name}</div>
      <div className="text-text-tertiary">
        {isLoading
          ? "checking…"
          : data
            ? `latest ${data.period_start.slice(0, 10)} · ${data.n_mentions} mentions`
            : "no digest yet"}
      </div>
    </div>
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
