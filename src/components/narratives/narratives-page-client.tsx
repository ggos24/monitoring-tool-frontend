"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Footer } from "@/components/dashboard/footer";
import {
  ScopeSelector,
  type ScopeSelection,
} from "@/components/dashboard/scope-selector";
import { TopBar } from "@/components/dashboard/top-bar";
import { NarrativeEvolution } from "@/components/narratives/narrative-evolution";
import { NarrativeInspector } from "@/components/narratives/narrative-inspector";
import { NarrativeList } from "@/components/narratives/narrative-list";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import {
  buildNarrativesHref,
  changeCounts,
  formatPeriodLabel,
  NARRATIVE_PERIOD_OPTIONS,
  sortPeriods,
  type NarrativesPageState,
  type NarrativeView,
  toScopeParam,
} from "@/lib/narrative-view";
import { formatUtcDateTime } from "@/lib/report-view";
import type { NarrativesResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_NARRATIVES = 40;

export function NarrativesPageClient({
  initialState,
}: {
  initialState: NarrativesPageState;
}) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const scopeParam = initialState.scope ? toScopeParam(initialState.scope) : null;
  const query = useQuery({
    queryKey: [
      "narratives",
      initialState.scope?.kind ?? null,
      initialState.scope?.id ?? null,
      initialState.seriesKey,
      initialState.periods,
    ],
    queryFn: () =>
      apiClient.narratives({
        scope: scopeParam!,
        series_key: initialState.seriesKey,
        limit_periods: initialState.periods,
        limit_narratives: MAX_NARRATIVES,
    }),
    enabled: scopeParam !== null,
  });

  const navigate = (state: NarrativesPageState) => {
    startTransition(() => {
      router.replace(buildNarrativesHref(state), { scroll: false });
    });
  };

  // Canonicalize backend-selected defaults into the URL. This makes a link
  // stable even when a scope has several report/digest series, and removes a
  // narrative selection that does not exist in the chosen range.
  useEffect(() => {
    const data = query.data;
    if (!data || !initialState.scope) return;
    const selectedExists = data.narratives.some(
      (narrative) => narrative.narrative_id === initialState.narrativeId,
    );
    const canonicalNarrativeId = selectedExists
      ? initialState.narrativeId
      : (data.narratives[0]?.narrative_id ?? null);
    if (
      initialState.seriesKey === data.selected_series_key &&
      initialState.narrativeId === canonicalNarrativeId
    ) {
      return;
    }
    router.replace(
      buildNarrativesHref({
        ...initialState,
        seriesKey: data.selected_series_key,
        narrativeId: canonicalNarrativeId,
      }),
      { scroll: false },
    );
  }, [initialState, query.data, router]);

  const setScope = (scope: ScopeSelection) => {
    navigate({
      ...initialState,
      scope,
      seriesKey: null,
      narrativeId: null,
    });
  };

  const selectNarrative = (narrativeId: string) => {
    if (narrativeId === initialState.narrativeId) return;
    navigate({ ...initialState, narrativeId });
  };

  const selectedNarrative =
    query.data?.narratives.find(
      (narrative) => narrative.narrative_id === initialState.narrativeId,
    ) ??
    query.data?.narratives[0] ??
    null;

  return (
    <>
      <TopBar scope={scopeParam} />
      <main
        className={cn(
          "mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-5",
          isNavigating && "opacity-80",
        )}
      >
        <PageHeader
          state={initialState}
          data={query.data}
          onScope={setScope}
          onNavigate={navigate}
          disabled={isNavigating}
        />

        {initialState.scope === null ? (
          <div className="border border-dashed border-border bg-card px-6 py-16 text-center">
            <p className="font-mono text-xs text-text-tertiary">
              Select a topic or group to explore narrative history.
            </p>
          </div>
        ) : query.isLoading && !query.data ? (
          <NarrativesSkeleton />
        ) : query.error ? (
          <ErrorState error={query.error as Error} onRetry={() => query.refetch()} />
        ) : query.data ? (
          <NarrativesContent
            state={initialState}
            data={query.data}
            selectedNarrativeId={selectedNarrative?.narrative_id ?? null}
            scope={initialState.scope}
            onNavigate={navigate}
            onSelectNarrative={selectNarrative}
          />
        ) : null}
      </main>
      <Footer />
    </>
  );
}

function PageHeader({
  state,
  data,
  onScope,
  onNavigate,
  disabled,
}: {
  state: NarrativesPageState;
  data: NarrativesResponse | undefined;
  onScope: (scope: ScopeSelection) => void;
  onNavigate: (state: NarrativesPageState) => void;
  disabled: boolean;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            Narrative intelligence
          </p>
          <h1 className="mt-1 text-2xl font-medium text-foreground">Narratives</h1>
          <p className="mt-1 text-sm text-text-tertiary">
            Track storylines across comparable report periods.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <ControlGroup label="Scope">
            <ScopeSelector value={state.scope} onChange={onScope} />
          </ControlGroup>

          <ControlGroup label="Comparable series">
            <select
              aria-label="Comparable narrative series"
              value={data?.selected_series_key ?? state.seriesKey ?? ""}
              disabled={disabled || !data || data.available_series.length === 0}
              onChange={(event) =>
                onNavigate({
                  ...state,
                  seriesKey: event.target.value || null,
                  narrativeId: null,
                })
              }
              className="h-9 min-w-64 max-w-full border border-border bg-card px-2 font-mono text-[11px] text-foreground outline-none transition-colors hover:border-strong focus:border-strong disabled:opacity-50"
            >
              {!data || data.available_series.length === 0 ? (
                <option value="">No series available</option>
              ) : (
                data.available_series.map((series) => (
                  <option key={series.series_key} value={series.series_key}>
                    {series.label} · {series.period_count} periods
                  </option>
                ))
              )}
            </select>
          </ControlGroup>

          <ControlGroup label="History">
            <div
              className="inline-flex h-9 items-center gap-0.5 border border-border bg-card p-0.5"
              role="group"
              aria-label="Narrative history range"
            >
              {NARRATIVE_PERIOD_OPTIONS.map((periods) => (
                <button
                  key={periods}
                  type="button"
                  aria-pressed={state.periods === periods}
                  disabled={disabled}
                  onClick={() =>
                    onNavigate({ ...state, periods, narrativeId: null })
                  }
                  className={cn(
                    "h-full px-2.5 font-mono text-[11px] transition-colors",
                    state.periods === periods
                      ? "bg-foreground text-primary-foreground"
                      : "text-text-tertiary hover:text-foreground",
                  )}
                >
                  {periods} periods
                </button>
              ))}
            </div>
          </ControlGroup>
        </div>
      </div>

      {data?.selected_series && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 font-mono text-[9px] text-text-tertiary">
          <span>
            Last observed · {formatUtcDateTime(data.selected_series.latest_period_end)}
          </span>
          <span aria-hidden>·</span>
          <span>{data.selected_series.cadence} cadence</span>
          <span aria-hidden>·</span>
          <span>
            {data.selected_series.comparable ? "Comparable series" : "Mixed window semantics"}
          </span>
        </div>
      )}
    </header>
  );
}

function NarrativesContent({
  state,
  data,
  selectedNarrativeId,
  scope,
  onNavigate,
  onSelectNarrative,
}: {
  state: NarrativesPageState;
  data: NarrativesResponse;
  selectedNarrativeId: string | null;
  scope: ScopeSelection;
  onNavigate: (state: NarrativesPageState) => void;
  onSelectNarrative: (narrativeId: string) => void;
}) {
  if (!data.selected_series || data.periods.length === 0) {
    return <NoRuns scope={scope} />;
  }

  const selectedNarrative =
    data.narratives.find((item) => item.narrative_id === selectedNarrativeId) ?? null;

  return (
    <>
      {data.periods.length === 1 ? (
        <div className="mb-4 border border-border bg-card px-4 py-3 font-mono text-[11px] text-text-secondary">
          Baseline captured · one analytical period is available. Evolution appears after the next comparable run.
        </div>
      ) : (
        <ChangeSummary data={data} />
      )}

      {!data.selected_series.comparable && (
        <div className="mb-4 border-l-2 border-warning bg-card px-4 py-3 text-xs text-warning">
          This series mixes window semantics. Snapshots remain visible, but lifecycle movement should be treated as provisional.
        </div>
      )}
      {data.truncated && (
        <div className="mb-4 border border-border bg-card px-4 py-2 font-mono text-[10px] text-text-tertiary">
          This projection is capped at {MAX_NARRATIVES} narratives; lower-prominence or earlier history may exist outside the loaded range.
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="hidden items-center gap-0.5 border border-border bg-card p-0.5 md:inline-flex">
          <ViewButton
            view="evolution"
            active={state.view === "evolution"}
            onSelect={(view) => onNavigate({ ...state, view })}
          />
          <ViewButton
            view="list"
            active={state.view === "list"}
            onSelect={(view) => onNavigate({ ...state, view })}
          />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary md:hidden">
          List · mobile view
        </span>
        <span className="font-mono text-[10px] text-text-tertiary">
          {data.narratives.length} narrative{data.narratives.length === 1 ? "" : "s"} · {data.periods.length} periods
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {state.view === "list" ? (
            <NarrativeList
              periods={data.periods}
              narratives={data.narratives}
              selectedId={selectedNarrativeId}
              onSelect={onSelectNarrative}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <NarrativeEvolution
                  periods={data.periods}
                  narratives={data.narratives}
                  selectedId={selectedNarrativeId}
                  onSelect={onSelectNarrative}
                />
              </div>
              <div className="md:hidden">
                <NarrativeList
                  periods={data.periods}
                  narratives={data.narratives}
                  selectedId={selectedNarrativeId}
                  onSelect={onSelectNarrative}
                />
              </div>
            </>
          )}
        </div>
        <NarrativeInspector narrative={selectedNarrative} periods={data.periods} scope={scope} />
      </div>
    </>
  );
}

function ChangeSummary({ data }: { data: NarrativesResponse }) {
  const counts = changeCounts(data.narratives, data.periods);
  const latest = sortPeriods(data.periods).at(-1)!;
  const items = [
    ["newly observed", counts.newly_observed, "default"],
    ["growing", counts.growing, "positive"],
    ["declining", counts.declining, "warning"],
    ["stable", counts.stable, "default"],
    ["not observed", counts.not_observed, "muted"],
  ] as const;
  return (
    <section className="mb-4" aria-label="Changes in the latest period">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] text-text-tertiary">
        <span className="uppercase tracking-[0.1em]">Change summary</span>
        <span>latest period · {formatPeriodLabel(latest.period_start)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
        {items.map(([label, value, tone]) => (
          <div key={label} className="bg-card px-3 py-2.5">
            <dt className="font-mono text-[9px] text-text-tertiary">{label}</dt>
            <dd
              className={cn(
                "mt-1 font-mono text-lg tabular-nums",
                tone === "positive" && "text-success",
                tone === "warning" && "text-warning",
                tone === "muted" && "text-muted-foreground",
                tone === "default" && "text-foreground",
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ViewButton({
  view,
  active,
  onSelect,
}: {
  view: NarrativeView;
  active: boolean;
  onSelect: (view: NarrativeView) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(view)}
      className={cn(
        "px-3 py-1.5 font-mono text-[11px] capitalize transition-colors",
        active
          ? "bg-foreground text-primary-foreground"
          : "text-text-tertiary hover:text-foreground",
      )}
    >
      {view}
    </button>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </span>
      {children}
    </div>
  );
}

function NoRuns({ scope }: { scope: ScopeSelection }) {
  const query = new URLSearchParams();
  query.set(scope.kind === "group" ? "group_id" : "topic_id", String(scope.id));
  return (
    <div className="border border-dashed border-border bg-card px-6 py-16 text-center">
      <p className="font-mono text-xs text-text-tertiary">
        No report runs are available for this scope yet.
      </p>
      <Link
        href={`/reports?${query.toString()}`}
        className="mt-3 inline-flex border border-border bg-elevated px-3 py-1.5 font-mono text-[11px] text-text-secondary hover:border-strong hover:text-foreground"
      >
        Generate a report ↗
      </Link>
    </div>
  );
}

function NarrativesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[520px] w-full" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="border border-destructive/40 bg-destructive/5 p-4">
      <p className="font-mono text-xs text-destructive">
        Failed to load narrative history: {error.message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 border border-border bg-card px-2.5 py-1 font-mono text-[10px] text-text-secondary hover:border-strong hover:text-foreground"
      >
        Retry
      </button>
    </div>
  );
}
