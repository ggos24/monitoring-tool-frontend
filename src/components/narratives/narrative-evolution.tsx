"use client";

import type { CSSProperties } from "react";

import { NarrativeStateBadge } from "@/components/narratives/narrative-state-badge";
import {
  formatPeriodLabel,
  formatShare,
  isActiveObservation,
  isNotObservedObservation,
  narrativePresentation,
  observationForPeriod,
  pointSize,
  sortNarratives,
  sortPeriods,
} from "@/lib/narrative-view";
import type { NarrativePeriod, NarrativeSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NarrativeEvolution({
  periods,
  narratives,
  selectedId,
  onSelect,
}: {
  periods: NarrativePeriod[];
  narratives: NarrativeSummary[];
  selectedId: string | null;
  onSelect: (narrativeId: string) => void;
}) {
  const orderedPeriods = sortPeriods(periods);
  const orderedNarratives = sortNarratives(narratives, orderedPeriods);
  const columns = `minmax(220px, 260px) repeat(${orderedPeriods.length}, minmax(82px, 1fr))`;
  const gridStyle = { gridTemplateColumns: columns } satisfies CSSProperties;

  if (orderedNarratives.length === 0) {
    return <EmptyEvolution />;
  }

  return (
    <section className="border border-border bg-card" aria-labelledby="evolution-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2
            id="evolution-heading"
            className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary"
          >
            Narrative evolution
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            Stable lanes across analytical periods. Point size is mention share.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 font-mono text-[9px] text-text-tertiary">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 border-2 border-success bg-foreground" aria-hidden />
            selected
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 bg-foreground" aria-hidden /> observed
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>—</span> not observed
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>·</span> no observation
          </span>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto" aria-label="Narrative evolution grid">
        <div className="min-w-max" role="grid" aria-rowcount={orderedNarratives.length + 1}>
          <div
            role="row"
            className="grid min-h-12 border-b border-border bg-elevated"
            style={gridStyle}
          >
            <div
              role="columnheader"
              className="sticky left-0 z-20 flex items-center border-r border-border bg-elevated px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary"
            >
              Narrative
            </div>
            {orderedPeriods.map((period) => (
              <div
                key={`${period.period_start}-${period.period_end}`}
                role="columnheader"
                className="flex flex-col items-center justify-center border-r border-border px-2 text-center font-mono text-[9px] text-text-tertiary last:border-r-0"
                title={`${period.period_start} → ${period.period_end}`}
              >
                <span className="text-text-secondary">
                  {formatPeriodLabel(period.period_start)}
                </span>
                <span>
                  {period.artifact_type} #{period.artifact_id}
                </span>
              </div>
            ))}
          </div>

          {orderedNarratives.map((narrative) => {
            const presentation = narrativePresentation(narrative, orderedPeriods);
            const selected = narrative.narrative_id === selectedId;
            const aligned = orderedPeriods.map((period) =>
              observationForPeriod(narrative, period),
            );
            return (
              <div
                key={narrative.narrative_id}
                role="row"
                className={cn(
                  "grid min-h-18 border-b border-border last:border-b-0 [content-visibility:auto] [contain-intrinsic-size:auto_72px]",
                  selected ? "bg-elevated" : "bg-card",
                )}
                style={gridStyle}
              >
                <div
                  role="rowheader"
                  className={cn(
                    "sticky left-0 z-20 min-w-0 border-r border-border",
                    selected ? "bg-elevated" : "bg-card",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(narrative.narrative_id)}
                    className="flex size-full min-w-0 flex-col items-start justify-center px-3 py-2 text-left transition-colors hover:bg-elevated focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="line-clamp-2 text-xs leading-snug text-foreground">
                      {narrative.name}
                    </span>
                    <span className="mt-1">
                      <NarrativeStateBadge
                        state={presentation.state}
                        label={presentation.label}
                      />
                    </span>
                  </button>
                </div>

                {aligned.map((observation, index) => {
                  const previous = index > 0 ? aligned[index - 1] : null;
                  const next = index < aligned.length - 1 ? aligned[index + 1] : null;
                  const active = isActiveObservation(observation);
                  const explicitlyNotObserved = isNotObservedObservation(observation);
                  const share = active ? observation.share_of_voice : null;
                  const label = active
                    ? `${narrative.name}, ${formatPeriodLabel(observation.period_start)}: ${formatShare(share)} mention share`
                    : `${narrative.name}, ${formatPeriodLabel(orderedPeriods[index].period_start)}: ${explicitlyNotObserved ? "not observed" : "no observation"}`;
                  return (
                    <div
                      key={`${narrative.narrative_id}-${orderedPeriods[index].period_start}`}
                      role="gridcell"
                      className="relative flex min-h-18 items-center justify-center border-r border-border last:border-r-0"
                    >
                      {active && isActiveObservation(previous) && (
                        <span
                          className="absolute top-1/2 right-1/2 left-0 border-t border-border"
                          aria-hidden
                        />
                      )}
                      {active && isActiveObservation(next) && (
                        <span
                          className="absolute top-1/2 right-0 left-1/2 border-t border-border"
                          aria-hidden
                        />
                      )}
                      {active ? (
                        <button
                          type="button"
                          aria-label={label}
                          aria-pressed={selected}
                          title={label}
                          onClick={() => onSelect(narrative.narrative_id)}
                          className={cn(
                            "relative z-10 shrink-0 border bg-foreground transition-colors hover:border-success focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "border-2 border-success outline outline-1 outline-offset-2 outline-foreground"
                              : "border-border",
                          )}
                          style={{ width: pointSize(share), height: pointSize(share) }}
                        />
                      ) : explicitlyNotObserved ? (
                        <span
                          className="relative z-10 bg-card px-1 font-mono text-[10px] text-muted-foreground"
                          aria-label={label}
                          title={label}
                        >
                          —
                        </span>
                      ) : (
                        <span
                          className="relative z-10 bg-card px-1 font-mono text-[12px] text-muted-foreground"
                          aria-label={label}
                          title={label}
                        >
                          ·
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EmptyEvolution() {
  return (
    <div className="flex min-h-72 items-center justify-center border border-border bg-card px-6 text-center font-mono text-[11px] text-text-tertiary">
      No narratives were observed in the selected history range.
    </div>
  );
}
