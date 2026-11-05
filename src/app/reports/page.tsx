"use client";

import { Suspense, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { TopBar } from "@/components/dashboard/top-bar";
import { Footer } from "@/components/dashboard/footer";
import { DigestResultView, ReportDetail } from "@/components/reports/report-detail";
import { ReportList } from "@/components/reports/report-list";
import { GenerateReportForm } from "@/components/reports/generate-report-form";
import { ScopeSelector, type ScopeSelection } from "@/components/dashboard/scope-selector";
import type {
  SegmentCondition,
} from "@/lib/types";
import { apiClient } from "@/lib/api";

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
  const scope: ScopeSelection | null =
    groupId !== null
      ? { kind: "group", id: groupId }
      : topicId !== null
        ? { kind: "topic", id: topicId }
        : null;
  const reportId = parseInt(search.get("report_id") ?? "", 10) || null;
  const digestResultId = parseId(search.get("digest_result_id"));
  const digestResultQuery = useQuery({
    queryKey: ["digest-result", digestResultId],
    queryFn: () => apiClient.getDigestResult(digestResultId as number),
    enabled: digestResultId !== null,
  });
  const digestDefinitionsQuery = useQuery({
    queryKey: ["digest-definitions", "all"],
    queryFn: () => apiClient.digestDefinitions(),
    enabled: digestResultId !== null,
  });
  const selectedDefinition = digestDefinitionsQuery.data?.find(
    (definition) =>
      definition.id === digestResultQuery.data?.digest_definition_id,
  );

  const scopeParam = () =>
    scope ? `${scope.kind === "group" ? "group_id" : "topic_id"}=${scope.id}` : "";

  const setScope = (next: ScopeSelection) => {
    const key = next.kind === "group" ? "group_id" : "topic_id";
    router.replace(`/reports?${key}=${next.id}`);
  };

  const selectReport = (newId: number) => {
    const parts = [scopeParam(), `report_id=${newId}`].filter(Boolean);
    setShowForm(false);
    router.replace(`/reports?${parts.join("&")}`);
  };

  const prefillFilters = parseFiltersFromSearch(search);
  const prefillFrom = search.get("date_from");
  const prefillTo = search.get("date_to");
  // The form sits behind "New report"; arriving from the Overview's
  // "Generate report" link (dates in the URL) opens it straight away.
  const [showForm, setShowForm] = useState(
    Boolean(prefillFrom || prefillTo),
  );

  return (
    <>
      <div className="contents print:hidden">
      <TopBar
        scope={
          scope === null
            ? null
            : scope.kind === "group"
              ? { group_id: scope.id }
              : { topic_id: scope.id }
        }
      />
      </div>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <ScopeSelector value={scope} onChange={setScope} />
          {scope !== null && !showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 border border-strong bg-foreground px-3 py-1.5 font-mono text-xs text-primary-foreground hover:bg-text-secondary"
            >
              <Plus className="size-3" /> New report
            </button>
          )}
        </div>

        {scope === null ? (
          <div className="border border-dashed border-border p-12 text-center text-sm text-text-tertiary">
            Select a narrative to view or generate reports.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 print:hidden">
              {showForm && (
                <GenerateReportForm
                  scope={scope}
                  prefillFilters={prefillFilters}
                  prefillDateFrom={prefillFrom}
                  prefillDateTo={prefillTo}
                  onCreated={selectReport}
                  onCancel={() => setShowForm(false)}
                />
              )}
              <section>
                <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
                  Recent
                </h2>
                <ReportList scope={scope} selectedId={reportId} />
              </section>
            </aside>
            <section className="lg:col-span-8 xl:col-span-9 print:col-span-12">
              {digestResultId !== null &&
              (digestResultQuery.isLoading || digestDefinitionsQuery.isLoading) ? (
                <div className="border border-dashed border-border p-12 text-center font-mono text-xs text-text-tertiary">
                  Loading scheduled run…
                </div>
              ) : digestResultId !== null && digestResultQuery.error ? (
                <div className="border border-destructive/40 bg-destructive/5 p-4 font-mono text-xs text-destructive">
                  Failed to load scheduled run: {(digestResultQuery.error as Error).message}
                </div>
              ) : digestResultId !== null && digestDefinitionsQuery.error ? (
                <div className="border border-destructive/40 bg-destructive/5 p-4 font-mono text-xs text-destructive">
                  Failed to load scheduled definition: {(digestDefinitionsQuery.error as Error).message}
                </div>
              ) : digestResultId !== null &&
                digestResultQuery.data &&
                !selectedDefinition ? (
                <div className="border border-destructive/40 bg-destructive/5 p-4 font-mono text-xs text-destructive">
                  Scheduled definition #{digestResultQuery.data.digest_definition_id} is unavailable.
                </div>
              ) : digestResultQuery.data && selectedDefinition ? (
                <DigestResultView
                  result={digestResultQuery.data}
                  definition={selectedDefinition}
                />
              ) : reportId !== null ? (
                <ReportDetail reportId={reportId} />
              ) : (
                <div className="border border-dashed border-border p-12 text-center text-sm text-text-tertiary">
                  Pick a report or create a new one.
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
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
  return out;
}
