"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { apiClient } from "@/lib/api";
import { TopBar } from "@/components/dashboard/top-bar";
import { Footer } from "@/components/dashboard/footer";
import { QuerySelector } from "@/components/dashboard/query-selector";
import type { ScopeParam, ScopeSelection } from "@/lib/types";
import { formatDayLabel, resolveWindow, type Period } from "@/lib/period";
import { FavorabilityPanel } from "@/components/dashboard/favorability-panel";
import { PeriodToggle } from "@/components/dashboard/period-toggle";
import { CountryFilter } from "@/components/dashboard/country-filter";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { TimelineChart } from "@/components/dashboard/timeline-chart";
import { SourcesList } from "@/components/dashboard/sources-list";
import {
  MentionsList,
  type SourceFilter,
} from "@/components/dashboard/mentions-list";
import { GenerateReportLink } from "@/components/dashboard/generate-report-link";
import { CoverageNote } from "@/components/dashboard/coverage-note";
import { CampaignKpiGrid } from "@/components/dashboard/campaign-kpi-grid";
import { DEFAULT_PERIOD, loadFilters, saveFilters } from "@/lib/dashboard-filters";
import { isCampaignGroupName } from "@/lib/narrative-rules";
import { PickupsPanel } from "@/components/dashboard/pickups-panel";
import { visibleTopics } from "@/lib/topics";
import { cn } from "@/lib/utils";

export default function Home() {
  const [scopeSel, setScopeSel] = useState<ScopeSelection | null>(null);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [country, setCountry] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  // Drill-down: a single day (YYYY-MM-DD) clicked on the timeline. When set,
  // every panel scopes to that day instead of the rolling period.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [source, setSource] = useState<SourceFilter>("all");
  // Δ vs the previous equal-length window on KPIs, sources, countries,
  // favorability, plus the dashed previous-period line on the timeline.
  const [compare, setCompare] = useState(true);

  // The picked query + filters survive reloads and the Reports round trip
  // (localStorage). Restored after mount so SSR markup stays deterministic;
  // nothing is written back until the restore has run.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const stored = loadFilters();
    if (stored.scope) setScopeSel(stored.scope);
    if (stored.period) setPeriod(stored.period);
    if (stored.country !== undefined) setCountry(stored.country);
    if (stored.source) setSource(stored.source);
    if (stored.compare !== undefined) setCompare(stored.compare);
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    saveFilters({ scope: scopeSel, period, country, source, compare });
  }, [restored, scopeSel, period, country, source, compare]);

  // `periodWin` drives the timeline (whole period, so a drilled day stays
  // in context); `win` drives every other panel (narrowed to the day).
  // Resolved once per render; preset bounds are hour-snapped, so stable.
  const periodWin = resolveWindow(period, null);
  const win = resolveWindow(period, selectedDay);

  // The API scope param: single topic or a group union.
  const scope: ScopeParam | null = scopeSel
    ? scopeSel.kind === "group"
      ? { group_id: scopeSel.id }
      : { topic_id: scopeSel.id }
    : null;

  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: apiClient.topics });
  const groupsQuery = useQuery({
    queryKey: ["topic-groups"],
    queryFn: apiClient.topicGroups,
  });
  const narratives = useMemo(
    () => visibleTopics(topicsQuery.data),
    [topicsQuery.data],
  );
  const poolTopicId =
    topicsQuery.data?.find((t) => t.role === "pool")?.id ?? null;
  // "All queries" = the `Campaign` topic group (set up by WS-3).
  const allGroup =
    groupsQuery.data?.find((g) => isCampaignGroupName(g.name)) ?? null;
  const topicNames = useMemo(
    () => new Map(narratives.map((t) => [t.id, t.name] as const)),
    [narratives],
  );

  // Default query: All queries when the Campaign group exists, else the
  // first query. Also replaces a restored pick that no longer exists
  // (deleted topic/group). Waits for both lists so it doesn't flip after load.
  const groupsSettled = groupsQuery.isSuccess || groupsQuery.isError;
  useEffect(() => {
    if (!restored || !topicsQuery.isSuccess || !groupsSettled) return;
    const stillExists =
      scopeSel !== null &&
      (scopeSel.kind === "group"
        ? (groupsQuery.data ?? []).some((g) => g.id === scopeSel.id)
        : narratives.some((t) => t.id === scopeSel.id));
    if (stillExists) return;
    if (allGroup) setScopeSel({ kind: "group", id: allGroup.id });
    else if (narratives.length > 0)
      setScopeSel({ kind: "topic", id: narratives[0].id });
  }, [restored, topicsQuery.isSuccess, groupsQuery.data, narratives, allGroup, groupsSettled, scopeSel]);

  // Distinguish "still loading / about to auto-select" (→ skeletons) from a
  // genuinely empty backend (→ a message, so skeletons don't spin forever).
  const noTopics =
    topicsQuery.isSuccess && narratives.length === 0;

  const handleSelectScope = (next: ScopeSelection) => {
    setScopeSel(next);
    setCountry(null);
    setSelectedDomain(null);
    setSelectedDay(null);
    setSource("all");
  };

  const handleSelectCountry = (iso2: string | null) => {
    setCountry(iso2);
    setSelectedDomain(null);
  };

  // Picking a period exits the day drill-down; picking the same day again
  // toggles it off.
  const handleSelectPeriod = (next: Period) => {
    setPeriod(next);
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
        <div className="mb-6 flex flex-col gap-3">
          <QuerySelector
            value={scopeSel}
            onChange={handleSelectScope}
            className="w-full sm:w-auto sm:min-w-[22rem] sm:self-start"
          />
          <div className="flex flex-wrap items-center gap-2">
            <PeriodToggle
              // Remount when a range is restored/applied so its inputs re-seed.
              key={period.kind === "range" ? `${period.from}_${period.to}` : "preset"}
              value={period}
              onChange={handleSelectPeriod}
            />
            {scope !== null && (
              <CountryFilter
                scope={scope}
                win={win}
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
            <div className="ml-auto flex items-center gap-4">
              <CompareToggle value={compare} onChange={setCompare} />
              <GenerateReportLink
                scope={scope}
                win={periodWin}
                country={country}
                source={source}
              />
            </div>
          </div>
        </div>

        {noTopics ? (
          <div className="mb-6 border border-border bg-card px-5 py-16 text-center">
            <p className="font-mono text-xs text-text-tertiary">
              No queries yet. Add one in Settings to start monitoring.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <CampaignKpiGrid
                compare={compare}
                scope={scope}
                win={win}
                country={country}
                // Deploy-order fallback only (backend without /api/campaign):
                // generic endpoints mix GDELT DOC + GN + RSS, so say so.
                fallback={
                  <>
                  <div className="border border-b-0 border-warning/40 bg-card px-5 py-2 font-mono text-[11px] text-warning">
                    All sources, not GKG — campaign headline unavailable on this backend.
                  </div>
                  <KpiGrid
                    compare={compare}
                    scope={scope}
                    win={win}
                    country={country}
                    poolTopicId={poolTopicId}
                  />
                  </>
                }
              />
              <CoverageNote />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-px border border-border bg-border lg:grid-cols-3">
              <div className="bg-card lg:col-span-2">
                <TimelineChart
                  scope={scope}
                  win={periodWin}
                  compare={compare}
                  country={country}
                  selectedDay={selectedDay}
                  onSelectDay={handleSelectDay}
                />
              </div>
              <div className="bg-card">
                <FavorabilityPanel
                  scope={scope}
                  win={win}
                  compare={compare}
                  country={country}
                />
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-px border border-border bg-border lg:grid-cols-7">
              <div className="bg-card lg:col-span-2">
                <SourcesList
                  scope={scope}
                  win={win}
                  // GN/RSS have no pre-campaign history: never show Δ for them.
                  compare={compare && source !== "gn" && source !== "rss"}
                  country={country}
                  source={source}
                  selectedDomain={selectedDomain}
                  onToggleDomain={toggleDomain}
                />
              </div>
              <div className="bg-card lg:col-span-5">
                <MentionsList
                  scope={scope}
                  win={win}
                  topicNames={topicNames}
                  domain={selectedDomain}
                  country={country}
                  source={source}
                  onChangeSource={setSource}
                  onClearDomain={() => setSelectedDomain(null)}
                />
              </div>
            </div>

            {/* Campaign-wide: Tier-1 articles that mention UNITED24. */}
            <div className="mb-6 border border-border bg-card">
              <PickupsPanel win={win} />
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

function CompareToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-2 font-mono text-[11px] text-text-tertiary transition-colors hover:text-foreground"
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex h-3 w-6 items-center border border-strong p-px transition-colors",
          value ? "justify-end bg-elevated" : "justify-start",
        )}
      >
        <span className={cn("size-2", value ? "bg-foreground" : "bg-text-tertiary")} />
      </span>
      Compare to previous period
    </button>
  );
}
