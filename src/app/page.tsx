"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { TopBar } from "@/components/dashboard/top-bar";
import { Footer } from "@/components/dashboard/footer";
import {
  ScopeSelector,
  type ReportScopeSel,
} from "@/components/reports/scope-selector";
import type { ScopeParam } from "@/lib/types";
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
import { AnomalyAlert } from "@/components/dashboard/anomaly-alert";
import { SentimentBreakdown } from "@/components/dashboard/sentiment-breakdown";
import { ResearchAssistant } from "@/components/dashboard/research-assistant";
import { GenerateReportLink } from "@/components/dashboard/generate-report-link";

export default function Home() {
  const [scopeSel, setScopeSel] = useState<ReportScopeSel | null>(null);
  const [days, setDays] = useState<number>(7);
  const [country, setCountry] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
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

  const handleSelectScope = (next: ReportScopeSel) => {
    setScopeSel(next);
    setCountry(null);
    setSelectedDomain(null);
    setSource("all");
    setQuality("all");
  };

  const handleSelectCountry = (iso2: string | null) => {
    setCountry(iso2);
    setSelectedDomain(null);
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
                value={country}
                onChange={handleSelectCountry}
              />
            )}
            <PeriodToggle value={days} onChange={setDays} />
            <GenerateReportLink
              scope={scope}
              days={days}
              country={country}
              source={source}
              quality={quality}
            />
          </div>
        </div>

        <div className="mb-6">
          {scope !== null && (
            <KpiGrid scope={scope} days={days} country={country} />
          )}
        </div>

        <div className="mb-6">
          <AnomalyAlert />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-px border border-border bg-border lg:grid-cols-3">
          <div className="bg-card lg:col-span-2">
            {scope !== null && (
              <TimelineChart scope={scope} days={days} country={country} />
            )}
          </div>
          <div className="bg-card">
            <SentimentBreakdown />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-px border border-border bg-border lg:grid-cols-7">
          <div className="bg-card lg:col-span-2">
            {scope !== null && (
              <SourcesList
                scope={scope}
                days={days}
                country={country}
                source={source}
                quality={quality}
                selectedDomain={selectedDomain}
                onToggleDomain={toggleDomain}
              />
            )}
          </div>
          <div className="bg-card lg:col-span-5">
            {scope !== null && (
              <MentionsList
                scope={scope}
                domain={selectedDomain}
                country={country}
                source={source}
                quality={quality}
                onChangeSource={setSource}
                onChangeQuality={setQuality}
                onClearDomain={() => setSelectedDomain(null)}
              />
            )}
          </div>
        </div>

        <ResearchAssistant />
      </main>
      <Footer />
    </>
  );
}
