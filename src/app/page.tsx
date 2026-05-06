"use client";

import { useState } from "react";

import { TopBar } from "@/components/dashboard/top-bar";
import { Footer } from "@/components/dashboard/footer";
import { TopicSelector } from "@/components/dashboard/topic-selector";
import { PeriodToggle } from "@/components/dashboard/period-toggle";
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

  return (
    <>
      <TopBar topicId={topicId} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TopicSelector value={topicId} onChange={setTopicId} />
          <PeriodToggle value={days} onChange={setDays} />
        </div>

        <div className="mb-6">
          {topicId !== null && <KpiGrid topicId={topicId} days={days} />}
        </div>

        <div className="mb-6">
          <AnomalyAlert />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-px border border-zinc-900 bg-zinc-900 lg:grid-cols-3">
          <div className="bg-black lg:col-span-2">
            {topicId !== null && (
              <TimelineChart topicId={topicId} days={days} />
            )}
          </div>
          <div className="bg-black">
            <SentimentBreakdown />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-px border border-zinc-900 bg-zinc-900 lg:grid-cols-3">
          <div className="bg-black">
            {topicId !== null && (
              <SourcesList topicId={topicId} days={days} />
            )}
          </div>
          <div className="bg-black lg:col-span-2">
            {topicId !== null && <MentionsList topicId={topicId} />}
          </div>
        </div>

        <ResearchAssistant />
      </main>
      <Footer topicId={topicId} />
    </>
  );
}
