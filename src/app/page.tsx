"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { apiClient } from "@/lib/api";
import { TopBar } from "@/components/dashboard/top-bar";
import { Footer } from "@/components/dashboard/footer";
import {
  ScopeSelector,
  type ReportScopeSel,
} from "@/components/reports/scope-selector";
import type { ScopeParam } from "@/lib/types";
import { formatDayLabel } from "@/lib/period";
import { PeriodToggle } from "@/components/dashboard/period-toggle";
import { CountryFilter } from "@/components/dashboard/country-filter";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { TimelineChart } from "@/components/dashboard/timeline-chart";
import { SourcesList } from "@/components/dashboard/sources-list";
import {
  MentionsList,
  type QualityFilter,
  type SourceFilter,
} from "@/components/dashboard/mentions-list";
import { SourceQualityBreakdown } from "@/components/dashboard/source-quality-breakdown";
import { ResearchAssistant } from "@/components/dashboard/research-assistant";
import { GenerateReportLink } from "@/components/dashboard/generate-report-link";

export default function Home() {
  const [scopeSel, setScopeSel] = useState<ReportScopeSel | null>(null);
  const [days, setDays] = useState<number>(7);
  const [country, setCountry] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  // Drill-down: a single day (YYYY-MM-DD) clicked on the timeline. When set,
  // every panel scopes to that day instead of the rolling period.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [source, setSource] = useState<SourceFilter>("all");
  const [quality, setQuality] = useState<QualityFilter>("all");

  // The API scope param: single topic or a group union.
  const scope: ScopeParam | null = scopeSel
    ? scopeSel.kind === "group"
      ? { group_id: scopeSel.id }
      : { topic_id: scopeSel.id }
    : null;

  // Auto-select the first topic on load (preserves the old dashboard
  // behaviour now that the selector no longer self-selects). User can
  // then switch to any topic or group.
  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: apiClient.topics });
  useEffect(() => {
    if (scopeSel === null && topicsQuery.data && topicsQuery.data.length > 0) {
      setScopeSel({ kind: "topic", id: topicsQuery.data[0].id });
    }
  }, [topicsQuery.data, scopeSel]);

  // Distinguish "still loading / about to auto-select" (→ skeletons) from a
  // genuinely empty backend (→ a message, so skeletons don't spin forever).
  const noTopics =
    topicsQuery.isSuccess && (topicsQuery.data?.length ?? 0) === 0;

  const handleSelectScope = (next: ReportScopeSel) => {
    setScopeSel(next);
    setCountry(null);
    setSelectedDomain(null);
    setSelectedDay(null);
    setSource("all");
    setQuality("all");
  };

  const handleSelectCountry = (iso2: string | null) => {
    setCountry(iso2);
    setSelectedDomain(null);
  };

  // Picking a period exits the day drill-down; picking the same day again
  // toggles it off.
  const handleSelectDays = (d: number) => {
    setDays(d);
    setSelectedDay(null);
  };
  const handleSelectDay = (day: string) => {
    setSelectedDay((prev) => (prev === day ? null : day));
  };

  const toggleDomain = (domain: string) => {
    setSelectedDomain((prev) => (prev === domain ? null : domain));
  };

  return (
    <>
      <TopBar scope={scope} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ScopeSelector value={scopeSel} onChange={handleSelectScope} />
          <div className="flex flex-wrap items-center gap-2">
            {scope !== null && (
              <CountryFilter
                scope={scope}
                days={days}
                selectedDay={selectedDay}
                value={country}
                onChange={handleSelectCountry}
              />
            )}
            {selectedDay && (
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                title="Clear day filter — back to the full period"
                className="inline-flex h-8 items-center gap-1.5 border border-strong bg-elevated px-2 font-mono text-[11px] text-foreground transition-colors hover:bg-overlay"
              >
                <span className="size-1.5 bg-success" aria-hidden />
                <span>{formatDayLabel(selectedDay)}</span>
                <X className="size-3 text-text-tertiary" />
              </button>
            )}
            <PeriodToggle value={days} onChange={handleSelectDays} />
            <GenerateReportLink
              scope={scope}
              days={days}
              country={country}
              source={source}
              quality={quality}
            />
          </div>
        </div>

        {noTopics ? (
          <div className="mb-6 border border-border bg-card px-5 py-16 text-center">
            <p className="font-mono text-xs text-text-tertiary">
              No topics yet. Add one in Settings to start monitoring.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <KpiGrid
                scope={scope}
                days={days}
                country={country}
                selectedDay={selectedDay}
              />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-px border border-border bg-border lg:grid-cols-3">
              <div className="bg-card lg:col-span-2">
                <TimelineChart
                  scope={scope}
                  days={days}
                  country={country}
                  selectedDay={selectedDay}
                  onSelectDay={handleSelectDay}
                />
              </div>
              <div className="bg-card">
                <SourceQualityBreakdown
                  scope={scope}
                  days={days}
                  country={country}
                  selectedDay={selectedDay}
                />
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-px border border-border bg-border lg:grid-cols-7">
              <div className="bg-card lg:col-span-2">
                <SourcesList
                  scope={scope}
                  days={days}
                  country={country}
                  selectedDay={selectedDay}
                  source={source}
                  quality={quality}
                  selectedDomain={selectedDomain}
                  onToggleDomain={toggleDomain}
                />
              </div>
              <div className="bg-card lg:col-span-5">
                <MentionsList
                  scope={scope}
                  domain={selectedDomain}
                  country={country}
                  selectedDay={selectedDay}
                  source={source}
                  quality={quality}
                  onChangeSource={setSource}
                  onChangeQuality={setQuality}
                  onClearDomain={() => setSelectedDomain(null)}
                />
              </div>
            </div>
          </>
        )}

        <ResearchAssistant />
      </main>
      <Footer />
    </>
  );
}
