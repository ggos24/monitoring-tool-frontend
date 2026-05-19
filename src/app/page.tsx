"use client";

import { useState } from "react";

import { TopBar } from "@/components/dashboard/top-bar";
import { Footer } from "@/components/dashboard/footer";
import { TopicSelector } from "@/components/dashboard/topic-selector";
import { PeriodToggle } from "@/components/dashboard/period-toggle";
import { CountryFilter } from "@/components/dashboard/country-filter";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { TimelineChart } from "@/components/dashboard/timeline-chart";
import { SourcesList } from "@/components/dashboard/sources-list";
import { MentionsList } from "@/components/dashboard/mentions-list";
import { AnomalyAlert } from "@/components/dashboard/anomaly-alert";
import { SentimentBreakdown } from "@/components/dashboard/sentiment-breakdown";
import { ResearchAssistant } from "@/components/dashboard/research-assistant";

export default function Home() {
  const [topicId, setTopicId] = useState<number | null>(null);
  const [days, setDays] = useState<number>(7);
  const [country, setCountry] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const handleSelectTopic = (id: number | null) => {
    setTopicId(id);
    setCountry(null);
    setSelectedDomain(null);
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
      <TopBar topicId={topicId} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TopicSelector value={topicId} onChange={handleSelectTopic} />
          <div className="flex flex-wrap items-center gap-2">
            {topicId !== null && (
              <CountryFilter
                topicId={topicId}
                days={days}
                value={country}
                onChange={handleSelectCountry}
              />
            )}
            <PeriodToggle value={days} onChange={setDays} />
          </div>
        </div>

        <div className="mb-6">
          {topicId !== null && (
            <KpiGrid topicId={topicId} days={days} country={country} />
          )}
        </div>

        <div className="mb-6">
          <AnomalyAlert />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-3">
          <div className="bg-black lg:col-span-2">
            {topicId !== null && (
              <TimelineChart topicId={topicId} days={days} country={country} />
            )}
          </div>
          <div className="bg-black">
            <SentimentBreakdown />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-7">
          <div className="bg-black lg:col-span-2">
            {topicId !== null && (
              <SourcesList
                topicId={topicId}
                days={days}
                country={country}
                selectedDomain={selectedDomain}
                onToggleDomain={toggleDomain}
              />
            )}
          </div>
          <div className="bg-black lg:col-span-5">
            {topicId !== null && (
              <MentionsList
                topicId={topicId}
                domain={selectedDomain}
                country={country}
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
