"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { NarrativeStateBadge } from "@/components/narratives/narrative-state-badge";
import {
  artifactHref,
  describeNarrativeChange,
  formatDeltaPp,
  formatPeriodLabel,
  formatShare,
  isNotObservedObservation,
  narrativePresentation,
  observationMomentumTag,
  periodForObservation,
  safeExternalUrl,
  sortPeriods,
} from "@/lib/narrative-view";
import {
  evidenceRefText,
  formatUtcDate,
  isVerbatimEvidence,
} from "@/lib/report-view";
import type {
  NarrativeObservation,
  NarrativeEvidenceRef,
  NarrativePeriod,
  NarrativeSummary,
  ScopeSelection,
} from "@/lib/types";

export function NarrativeInspector({
  narrative,
  periods,
  scope,
}: {
  narrative: NarrativeSummary | null;
  periods: NarrativePeriod[];
  scope: ScopeSelection;
}) {
  if (!narrative) {
    return (
      <aside className="flex min-h-64 items-center justify-center border border-border bg-card px-6 text-center font-mono text-[11px] text-text-tertiary">
        Select a narrative to inspect its history and evidence.
      </aside>
    );
  }

  const orderedPeriods = sortPeriods(periods);
  const view = narrativePresentation(narrative, orderedPeriods);
  const currentPeriod = view.latest
    ? periodForObservation(orderedPeriods, view.latest)
    : null;
  const evidenceObservation = observationWithEvidence(narrative);
  const evidencePeriod = evidenceObservation
    ? periodForObservation(orderedPeriods, evidenceObservation)
    : null;
  const history = [...narrative.observations].sort((left, right) =>
    right.period_start.localeCompare(left.period_start),
  );
  const momentum = observationMomentumTag(view.current);

  return (
    <aside
      className="border border-border bg-card lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
      aria-live="polite"
      aria-labelledby="narrative-inspector-heading"
    >
      <header className="border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
            Narrative inspector
          </span>
          <NarrativeStateBadge state={view.state} label={view.label} />
        </div>
        <h2 id="narrative-inspector-heading" className="mt-3 text-base font-medium text-foreground">
          {narrative.name}
        </h2>
        <p className="mt-1 break-all font-mono text-[9px] text-muted-foreground">
          {narrative.narrative_id}
        </p>
        {narrative.claim && (
          <p className="mt-3 text-xs leading-relaxed text-text-secondary">
            {narrative.claim}
          </p>
        )}
      </header>

      <section className="border-b border-border p-4">
        <SectionHeading>What changed</SectionHeading>
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
          {describeNarrativeChange(narrative, orderedPeriods)}
        </p>
        {view.shareDelta != null && (
          <p className="mt-1 font-mono text-[10px] text-text-tertiary">
            Current delta · {formatDeltaPp(view.shareDelta)}
          </p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-px border-b border-border bg-border">
        <InspectorMetric label="Mention share" value={formatShare(view.current?.share_of_voice)} />
        <InspectorMetric label="Reach share" value={formatShare(view.current?.reach_sov)} />
        <InspectorMetric label="Mentions" value={formatInteger(view.current?.n_mentions)} />
        <InspectorMetric label="Outlets" value={formatInteger(view.current?.n_publishers)} />
      </dl>

      <section className="border-b border-border p-4">
        <SectionHeading>Observation status</SectionHeading>
        <dl className="mt-2 space-y-1.5 font-mono text-[10px]">
          <MetaRow label="First in loaded range" value={formatUtcDate(narrative.first_observed_at)} />
          <MetaRow label="Last observed" value={formatUtcDate(narrative.last_observed_at)} />
          <MetaRow label="Loaded observations" value={String(narrative.observation_count)} />
          <MetaRow label="Momentum" value={momentum ?? "—"} />
          <MetaRow
            label="Identity"
            value={
              narrative.identity_source === "persisted"
                ? "Persisted narrative ID"
                : "Legacy deterministic fallback"
            }
          />
          <MetaRow
            label="Match confidence"
            value={
              view.current?.match_score == null
                ? "—"
                : `${Math.round(view.current.match_score * 100)}%`
            }
          />
        </dl>
        {currentPeriod && (
          <Link
            href={artifactHref(currentPeriod, scope)}
            className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] text-text-secondary underline-offset-2 hover:text-foreground hover:underline"
          >
            Open originating {currentPeriod.artifact_type} <ExternalLink className="size-3" />
          </Link>
        )}
      </section>

      {view.current &&
        (view.current.countries.length > 0 || view.current.top_domains.length > 0) && (
          <section className="border-b border-border p-4">
            <SectionHeading>Current footprint</SectionHeading>
            {view.current.countries.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {view.current.countries.slice(0, 6).map((country) => (
                  <span
                    key={country.country}
                    className="border border-border bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-text-secondary"
                  >
                    {country.country} · {country.count}
                  </span>
                ))}
              </div>
            )}
            {view.current.top_domains.length > 0 && (
              <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
                Outlets: {view.current.top_domains.join(", ")}
              </p>
            )}
          </section>
        )}

      <section className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <SectionHeading>Evidence</SectionHeading>
          {evidenceObservation && (
            <span className="font-mono text-[9px] text-muted-foreground">
              latest observed · {formatPeriodLabel(evidenceObservation.period_start)}
            </span>
          )}
        </div>
        {evidenceObservation && evidenceObservation.evidence_refs.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {evidenceObservation.evidence_refs.map((evidence, index) => (
              <EvidenceItem key={`${evidence.mention_id}-${index}`} evidence={evidence} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 font-mono text-[10px] text-text-tertiary">
            No source-linked evidence was stored for the latest observation.
          </p>
        )}
        {evidencePeriod && (
          <Link
            href={artifactHref(evidencePeriod, scope)}
            className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] text-text-secondary underline-offset-2 hover:text-foreground hover:underline"
          >
            Review full evidence in report <ExternalLink className="size-3" />
          </Link>
        )}
      </section>

      <section className="p-4">
        <SectionHeading>Observation history</SectionHeading>
        <ol className="mt-2 border border-border">
          {history.map((observation) => {
            const period = periodForObservation(orderedPeriods, observation);
            const notObserved = isNotObservedObservation(observation);
            return (
              <li
                key={`${observation.period_start}-${observation.period_end}`}
                className="flex items-center justify-between gap-3 border-b border-border px-2.5 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-text-secondary">
                    {formatPeriodLabel(observation.period_start)}
                  </p>
                  <p className="font-mono text-[9px] text-text-tertiary">
                    {notObserved
                      ? "Not observed"
                      : `${formatShare(observation.share_of_voice)} share · ${formatInteger(observation.n_mentions)} mentions`}
                  </p>
                </div>
                {period && (
                  <Link
                    href={artifactHref(period, scope)}
                    className="shrink-0 font-mono text-[9px] text-text-secondary hover:text-foreground hover:underline"
                    aria-label={`Open ${period.artifact_type} for ${formatPeriodLabel(period.period_start)}`}
                  >
                    #{period.artifact_id} ↗
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </aside>
  );
}

function EvidenceItem({ evidence }: { evidence: NarrativeEvidenceRef }) {
  const url = safeExternalUrl(evidence.url);
  const verbatim = isVerbatimEvidence(evidence);
  const text = evidenceRefText(evidence);
  return (
    <li className="border border-border bg-elevated p-2.5">
      <div className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-[0.08em] text-text-tertiary">
        <span>{verbatim ? "Verified direct quote" : "Source-backed paraphrase"}</span>
        <span>#{evidence.mention_id}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
        {verbatim ? `“${text}”` : text}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {evidence.title && (
            <p className="truncate text-[10px] text-text-secondary" title={evidence.title}>
              {evidence.title}
            </p>
          )}
          <p className="font-mono text-[8px] text-text-tertiary">
            {[
              evidence.domain,
              evidence.published_at ? formatUtcDate(evidence.published_at) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-mono text-[9px] text-text-secondary hover:text-foreground hover:underline"
          >
            Source ↗
          </a>
        )}
      </div>
    </li>
  );
}

function observationWithEvidence(narrative: NarrativeSummary): NarrativeObservation | null {
  if ((narrative.current?.evidence_refs.length ?? 0) > 0) return narrative.current;
  return (
    [...narrative.observations]
      .sort((left, right) => right.period_start.localeCompare(left.period_start))
      .find((observation) => observation.evidence_refs.length > 0) ?? null
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
      {children}
    </h3>
  );
}

function InspectorMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-elevated px-3 py-2.5">
      <dt className="font-mono text-[8px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="text-right text-text-secondary">{value}</dd>
    </div>
  );
}

function formatInteger(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : String(Math.round(value));
}
