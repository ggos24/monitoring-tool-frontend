"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

import { apiClient } from "@/lib/api";
import { countryName, iso2ToFlagEmoji } from "@/lib/country";
import {
  clusterHandle,
  clusterMomentumTag,
  clusterSlopeRatio,
  clusterTitle,
  corpusReportBasis,
  evidenceRefText,
  formatReportFilter,
  formatReportWindow,
  formatUtcDate,
  formatUtcDateTime,
  isVerbatimEvidence,
  rankNarratives,
  reportFilters,
  reportTypeLabel,
  resolveBriefSections,
  resolveReportType,
  selectedReportBasis,
  type BriefSections,
} from "@/lib/report-view";
import type {
  DigestDefinition,
  DigestResultDetail,
  PerMediaStanceEntry,
  Report,
  ReportAggregates,
  ReportBasis,
  ReportClusterSummary,
  ReportEvidenceRef,
  ReportType,
  StanceByCountryEntry,
  StanceLabel,
} from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STANCE_COLORS: Record<StanceLabel, string> = {
  supportive: "bg-success/15 text-success",
  critical: "bg-destructive/15 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  mixed: "bg-warning/15 text-warning",
};

const POLL_INTERVAL_MS = 2000;
const DEFAULT_VISIBLE_NARRATIVES = 5;

type BriefConvenience = Pick<
  Report,
  "bottom_line" | "bluf_bullets" | "trends" | "watchlist" | "caveats"
>;

export function ReportDetail({ reportId }: { reportId: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => apiClient.getReport(reportId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running"
        ? POLL_INTERVAL_MS
        : false;
    },
  });

  if (isLoading) return <ReportSkeleton />;
  if (error) {
    return (
      <ErrorPane
        title="Failed to load report"
        detail={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }
  if (!data) return null;
  if (data.status === "pending" || data.status === "running") {
    return <PendingPane status={data.status} />;
  }
  if (data.status === "failed") {
    return (
      <ErrorPane
        title="Report generation failed"
        detail={data.error ?? "Unknown error"}
      />
    );
  }

  const reportType = resolveReportType(
    data.report_type,
    data.params,
    data.aggregates,
  );
  const scope = resolveScopeLabel(data);

  return (
    <div className="flex flex-col gap-8">
      <ContextHeader
        eyebrow={`Report #${data.id}`}
        scopeLabel={scope.label}
        scopeKind={scope.kind}
        reportType={reportType}
        params={data.params}
        createdAt={data.created_at}
        meta={[
          data.cached ? "cached result" : null,
          data.model,
          data.source_max_collected_at
            ? `source snapshot ${formatUtcDateTime(data.source_max_collected_at)}`
            : null,
        ]}
        quality={data.aggregates?.data_quality}
      />
      <ReportBody
        key={data.id}
        reportType={reportType}
        narrative={data.narrative}
        clusters={data.clusters ?? []}
        aggregates={data.aggregates}
        briefConvenience={data}
        errorNote={data.error}
      />
    </div>
  );
}

export function DigestResultView({
  result,
  definition,
}: {
  result: DigestResultDetail;
  definition: DigestDefinition;
}) {
  const aggregates: ReportAggregates | null =
    result.aggregates ??
    (result.publisher_weighted_stance
      ? {
          n_mentions: result.n_mentions,
          publisher_weighted_stance: result.publisher_weighted_stance,
          tier_breakdown: result.tier_breakdown ?? {},
          recency_timeline: result.recency_timeline ?? [],
          volume_z_score: result.volume_z_score,
          sentiment_distribution: result.sentiment_distribution,
          key_themes: result.key_themes,
          representative_outlets: result.representative_outlets,
          dominant_framing: result.dominant_framing,
          notable_divergence: result.notable_divergence,
          confidence: result.confidence,
        }
      : null);
  const reportType = resolveReportType(
    result.report_type ?? definition.report_type,
    null,
    aggregates,
  );
  const provenanceWindow = result.provenance?.window;
  const dateFrom = provenanceWindow?.date_from ?? result.period_start;
  const dateTo = provenanceWindow?.date_to ?? nextUtcDay(result.period_start);
  const params: Record<string, unknown> = {
    date_from: dateFrom,
    date_to: dateTo,
    filters: definition.segment,
    report_type: reportType,
  };

  return (
    <div className="flex flex-col gap-8">
      <ContextHeader
        eyebrow={`Scheduled run #${result.id}`}
        scopeLabel={aggregates?.scope?.label ?? definition.name}
        scopeKind="Scheduled topic report"
        reportType={reportType}
        params={params}
        createdAt={result.created_at}
        meta={[
          `${result.n_mentions} analyzed mentions`,
          result.status ? `run ${result.status}` : null,
          result.delivery_status
            ? `delivery ${result.delivery_status.replaceAll("_", " ")}`
            : null,
          result.model,
        ]}
        quality={aggregates?.data_quality}
      />
      <ScheduledRunNotice result={result} />
      <ReportBody
        key={result.id}
        reportType={reportType}
        narrative={result.narrative || null}
        clusters={result.clusters ?? []}
        aggregates={aggregates}
        briefConvenience={null}
        errorNote={result.status === "partial" ? result.error ?? result.reason ?? null : null}
      />
    </div>
  );
}

function ScheduledRunNotice({ result }: { result: DigestResultDetail }) {
  const status = result.status ?? "success";
  const deliveryFailed = result.delivery_status === "failed";
  if (status === "success" && !deliveryFailed && !result.reason) return null;
  const detail = result.error ?? result.reason;
  return (
    <div
      className={cn(
        "border-l-2 bg-card px-4 py-3",
        status === "failed" || deliveryFailed
          ? "border-destructive"
          : status === "skipped"
            ? "border-text-tertiary"
            : "border-warning",
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary">
        Run status: {status}
      </p>
      {detail && <p className="mt-1 text-sm text-text-secondary">{detail}</p>}
      {deliveryFailed && (
        <p className="mt-1 text-xs text-destructive">
          Delivery failed{result.delivery_error ? `: ${result.delivery_error}` : "."}
        </p>
      )}
    </div>
  );
}

export function ReportBody({
  reportType,
  narrative,
  clusters,
  aggregates,
  briefConvenience,
  errorNote,
}: {
  reportType: ReportType;
  narrative: string | null;
  clusters: ReportClusterSummary[];
  aggregates: ReportAggregates | null;
  briefConvenience: Partial<BriefConvenience> | null;
  errorNote: string | null;
}) {
  const isGroup = aggregates?.scope?.is_group ?? false;
  const sections = resolveBriefSections(aggregates, briefConvenience);

  return (
    <>
      {errorNote && (
        <div className="border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm text-warning">
          Partial result: {errorNote}
        </div>
      )}

      <MetricGrid clusters={clusters} aggregates={aggregates} />

      {sections.hasStructuredContent ? (
        <StructuredBrief sections={sections} />
      ) : (
        <LegacyNarrative narrative={narrative} reportType={reportType} />
      )}

      <NarrativesSection
        clusters={clusters}
        isGroup={isGroup}
        departed={aggregates?.departed_narratives ?? []}
      />

      <DataQualityPanel aggregates={aggregates} />

      {(isGroup || aggregates) && (
        <details className="border border-border bg-card">
          <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-text-secondary hover:bg-elevated">
            Explore deterministic breakdowns
          </summary>
          <div className="flex flex-col gap-7 border-t border-border p-4">
            {isGroup && aggregates?.per_topic && aggregates.per_topic.length > 0 && (
              <PerTopicPanel rows={aggregates.per_topic} />
            )}
            {isGroup &&
              aggregates?.framing_distribution &&
              Object.keys(aggregates.framing_distribution).length > 0 && (
                <FramingPanel dist={aggregates.framing_distribution} />
              )}
            {aggregates && (
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {!isGroup && (
                  <StanceWeightedPanel
                    label="Publisher-weighted stance"
                    values={aggregates.publisher_weighted_stance}
                  />
                )}
                <TierBreakdownPanel
                  tiers={aggregates.tier_breakdown}
                  showStance={!isGroup}
                />
              </section>
            )}
            {!isGroup &&
              aggregates?.stance_by_country &&
              aggregates.stance_by_country.length > 0 && (
                <StanceByCountryPanel rows={aggregates.stance_by_country} />
              )}
            {!isGroup &&
              aggregates?.per_media_stance &&
              aggregates.per_media_stance.length > 0 && (
                <PerMediaStancePanel rows={aggregates.per_media_stance} />
              )}
            {aggregates?.recency_timeline &&
              aggregates.recency_timeline.length > 0 && (
                <TimelinePanel timeline={aggregates.recency_timeline} />
              )}
          </div>
        </details>
      )}
    </>
  );
}

function ContextHeader({
  eyebrow,
  scopeLabel,
  scopeKind,
  reportType,
  params,
  createdAt,
  meta,
  quality,
}: {
  eyebrow: string;
  scopeLabel: string;
  scopeKind: string;
  reportType: ReportType;
  params: Record<string, unknown>;
  createdAt: string;
  meta: Array<string | null | undefined>;
  quality?: ReportAggregates["data_quality"];
}) {
  const filters = reportFilters(params);
  return (
    <header className="border-b border-border pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            <span>{eyebrow}</span>
            <span aria-hidden>·</span>
            <span>{scopeKind}</span>
          </div>
          <h1 className="text-xl font-medium text-foreground">{scopeLabel}</h1>
          <p className="mt-1 font-mono text-[11px] text-text-secondary">
            {formatReportWindow(params)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {/* How far to trust the numbers belongs next to them, not 4000px
                down the page next to the rubric that explains the grade. */}
            {quality !== undefined && <DataQualityBadge quality={quality} />}
            <span className="border border-strong bg-elevated px-2 py-1 font-mono text-[10px] text-foreground">
              {reportTypeLabel(reportType)}
            </span>
          </div>
          <time
            dateTime={createdAt}
            className="font-mono text-[10px] text-text-tertiary"
          >
            Generated {formatUtcDateTime(createdAt)}
          </time>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {filters.length === 0 ? (
          <span className="border border-border bg-card px-2 py-1 font-mono text-[10px] text-text-tertiary">
            No additional filters
          </span>
        ) : (
          filters.map((condition, index) => (
            <span
              key={`${condition.field}-${condition.op}-${index}`}
              className="border border-border bg-card px-2 py-1 font-mono text-[10px] text-text-secondary"
            >
              {formatReportFilter(condition)}
            </span>
          ))
        )}
      </div>
      {meta.filter(Boolean).length > 0 && (
        <p className="mt-3 font-mono text-[10px] text-text-tertiary">
          {meta.filter(Boolean).join(" · ")}
        </p>
      )}
    </header>
  );
}

function MetricGrid({
  clusters,
  aggregates,
}: {
  clusters: ReportClusterSummary[];
  aggregates: ReportAggregates | null;
}) {
  const selected = selectedReportBasis(aggregates);
  const ranked = rankNarratives(clusters);
  const analyzed =
    selected?.analyzed_in_report ?? aggregates?.n_mentions ?? sumClusterMentions(clusters);
  const clustered =
    selected?.clustered_in_report ??
    selected?.clustered_mentions ??
    sumClusterMentions(clusters);
  const clusterCoverage = percentOf(clustered, analyzed);
  const leadShare = ranked[0]?.share_of_voice;

  return (
    <section aria-label="Report metrics" className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
      <MetricCard
        label="Analyzed mentions"
        value={formatNumber(analyzed)}
        note="Selected scope after report filters"
      />
      <MetricCard
        label="Narratives"
        value={formatNumber(clusters.length)}
        note="Deterministic embedding clusters"
      />
      <MetricCard
        label="Cluster coverage"
        value={clusterCoverage === null ? "—" : formatPercent(clusterCoverage)}
        note={`${formatNumber(clustered)} of ${formatNumber(analyzed)} analyzed`}
      />
      <MetricCard
        label="Leading narrative share"
        value={
          leadShare == null ? "—" : formatPercent(Math.max(0, leadShare) * 100)
        }
        note="Share of analyzed mentions"
      />
    </section>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="min-h-28 bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-2 text-[26px] font-medium tabular-nums text-foreground">
        {value}
      </div>
      <p className="mt-1 text-[11px] text-text-tertiary">{note}</p>
    </div>
  );
}

function StructuredBrief({ sections }: { sections: BriefSections }) {
  return (
    <section aria-labelledby="brief-heading" className="flex flex-col gap-5">
      <div>
        <h2
          id="brief-heading"
          className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary"
        >
          Bottom line
        </h2>
        <div className="border-l-2 border-foreground bg-card px-5 py-4">
          {sections.bottomLine ? (
            <p className="text-base leading-relaxed text-foreground">
              {sections.bottomLine}
            </p>
          ) : (
            <p className="text-sm text-text-tertiary">No bottom line was produced.</p>
          )}
          {sections.bullets.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-text-secondary">
              {sections.bullets.map((bullet, index) => (
                <li key={index} className="flex gap-2">
                  <span aria-hidden className="font-mono text-text-tertiary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(sections.trends || sections.watchlist.length > 0) && (
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
          <BriefTextBlock label="What changed" text={sections.trends} />
          <div className="bg-card p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
              Watchlist
            </h3>
            {sections.watchlist.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-secondary">
                {sections.watchlist.map((item, index) => (
                  <li key={index} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-text-tertiary">
                No evidence-backed watch item.
              </p>
            )}
          </div>
        </div>
      )}

      {sections.caveats && (
        <div className="border border-border bg-card p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            Caveats
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {sections.caveats}
          </p>
        </div>
      )}
    </section>
  );
}

function BriefTextBlock({ label, text }: { label: string; text: string | null }) {
  return (
    <div className="bg-card p-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </h3>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
        {text ?? "No measurable change was stated."}
      </p>
    </div>
  );
}

function LegacyNarrative({
  narrative,
  reportType,
}: {
  narrative: string | null;
  reportType: ReportType;
}) {
  if (!narrative) {
    return (
      <p className="text-sm italic text-text-tertiary">
        No narrative was produced (zero clusters or degraded generation).
      </p>
    );
  }
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">
          {reportType === "executive" ? "Legacy narrative" : "Brief narrative"}
        </h2>
        <span className="font-mono text-[10px] text-text-tertiary">
          Unstructured fallback
        </span>
      </div>
      <div className="border border-border bg-card p-4">
        {narrative
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((paragraph, index) => (
            <p
              key={index}
              className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground last:mb-0"
            >
              {paragraph}
            </p>
          ))}
      </div>
    </section>
  );
}

function NarrativesSection({
  clusters,
  isGroup,
  departed,
}: {
  clusters: ReportClusterSummary[];
  isGroup: boolean;
  departed: NonNullable<ReportAggregates["departed_narratives"]>;
}) {
  const [showAll, setShowAll] = useState(false);
  // Card bodies (prose, contested note, evidence, outlet list) stay closed by
  // default so the section reads as a scannable list of narratives. The scan
  // layer — heading, claim, action, metrics, origins — is always visible.
  const [openBodies, setOpenBodies] = useState<Set<string>>(new Set());
  const ranked = rankNarratives(clusters);
  const visible = showAll ? ranked : ranked.slice(0, DEFAULT_VISIBLE_NARRATIVES);
  const hiddenCount = Math.max(ranked.length - DEFAULT_VISIBLE_NARRATIVES, 0);
  const visibleKeys = visible.map(narrativeKey);
  const allOpen =
    visibleKeys.length > 0 && visibleKeys.every((key) => openBodies.has(key));

  const toggleBody = (key: string) =>
    setOpenBodies((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleAllBodies = () =>
    setOpenBodies((current) => {
      if (allOpen) {
        const next = new Set(current);
        visibleKeys.forEach((key) => next.delete(key));
        return next;
      }
      return new Set([...current, ...visibleKeys]);
    });

  if (ranked.length === 0 && departed.length === 0) return null;
  return (
    <section aria-labelledby="narratives-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="narratives-heading"
            className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary"
          >
            Top narratives
          </h2>
          <p className="mt-1 text-xs text-text-tertiary">
            Ordered by deterministic prominence: volume adjusted by audience reach.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {visible.length > 0 && (
            <button
              type="button"
              aria-expanded={allOpen}
              onClick={toggleAllBodies}
              className="flex items-center gap-1 border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] text-text-secondary hover:border-strong hover:text-foreground"
            >
              {allOpen ? (
                <>
                  <ChevronUp className="size-3" /> Collapse detail
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" /> Expand detail
                </>
              )}
            </button>
          )}
          {hiddenCount > 0 && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
              className="flex items-center gap-1 border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] text-text-secondary hover:border-strong hover:text-foreground"
            >
              {showAll ? (
                <>
                  <ChevronUp className="size-3" /> Show top 5
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" /> Show {hiddenCount} more
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {visible.map((cluster, index) => {
          const key = narrativeKey(cluster);
          return (
            <NarrativeCard
              key={key}
              cluster={cluster}
              rank={index + 1}
              isGroup={isGroup}
              open={openBodies.has(key)}
              onToggle={() => toggleBody(key)}
            />
          );
        })}
      </div>
      {departed.length > 0 && <DepartedNarratives rows={departed} />}
    </section>
  );
}

function narrativeKey(cluster: ReportClusterSummary): string {
  return String(cluster.narrative_id ?? cluster.cluster_id);
}

function NarrativeCard({
  cluster,
  rank,
  isGroup,
  open,
  onToggle,
}: {
  cluster: ReportClusterSummary;
  rank: number;
  isGroup: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const countries = Object.entries(cluster.countries ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
  const share =
    cluster.share_of_voice == null ? null : Math.max(0, cluster.share_of_voice) * 100;
  const reachShare =
    cluster.reach_sov == null ? null : Math.max(0, cluster.reach_sov) * 100;
  const topDomains = cluster.top_domains ?? [];
  const evidenceRefs = cluster.evidence_refs ?? [];
  const handle = clusterHandle(cluster);
  const bodyId = `narrative-body-${narrativeKey(cluster)}`;
  const hasBody = Boolean(
    cluster.narrative ||
      cluster.contested ||
      evidenceRefs.length > 0 ||
      (cluster.top_quotes ?? []).length > 0 ||
      cluster.evidence ||
      topDomains.length > 0,
  );

  return (
    // `contain-intrinsic-size` is required alongside `content-visibility`:
    // without it, off-screen cards collapse to padding height, which makes the
    // scrollbar jump while scrolling and hides them from in-page search. The
    // `auto` keyword reuses each card's real height once it has rendered.
    <article className="border border-border bg-card p-4 [content-visibility:auto] [contain-intrinsic-size:auto_320px]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-text-tertiary">
              {String(rank).padStart(2, "0")}
            </span>
            <h3 className="text-base font-medium text-foreground">
              {clusterTitle(cluster, rank)}
            </h3>
            <LifecycleBadge cluster={cluster} />
          </div>
          {handle && (
            <p className="mb-1 font-mono text-[10px] text-text-tertiary">{handle}</p>
          )}
          {cluster.claim && (
            <p className="text-sm leading-relaxed text-text-secondary">{cluster.claim}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {/* "Disputed" is a scan-layer signal, so it stays visible while the
              conflicting-accounts text itself lives in the collapsed body. */}
          {cluster.contested && (
            <span
              title={cluster.contested}
              className="border border-warning/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-warning"
            >
              Contested
            </span>
          )}
          <MomentumBadge cluster={cluster} />
          {!isGroup && cluster.dominant_stance && (
            <StanceBadge stance={cluster.dominant_stance} />
          )}
        </div>
      </header>

      <DecisionCue cluster={cluster} />

      <dl className="mt-4 grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
        <NarrativeMetric label="Mention share" value={share == null ? "—" : formatPercent(share)} />
        <NarrativeMetric
          label="Reach share"
          value={reachShare == null ? "—" : formatPercent(reachShare)}
        />
        <NarrativeMetric label="Mentions" value={formatNumber(cluster.n_mentions)} />
        <NarrativeMetric label="Outlets" value={formatNumber(cluster.n_publishers)} />
        <NarrativeMetric
          label="Mean reach"
          value={
            cluster.mean_reach_score == null
              ? "—"
              : `${Math.round(cluster.mean_reach_score)}/100`
          }
        />
      </dl>

      {countries.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-text-tertiary">
          <span className="mr-1 uppercase tracking-[0.1em]">
            Mentions from (source origin)
          </span>
          {countries.map(([iso, count]) => (
            <span
              key={iso}
              className="border border-border bg-elevated px-1.5 py-0.5 text-text-secondary"
              title={countryName(iso)}
            >
              {iso2ToFlagEmoji(iso)} {iso} · {count}
            </span>
          ))}
        </div>
      )}

      {hasBody && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={onToggle}
            className="mt-3 flex w-full items-center gap-1 border-t border-border pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary hover:text-foreground"
          >
            {open ? (
              <>
                <ChevronUp className="size-3" /> Hide detail
              </>
            ) : (
              <>
                <ChevronDown className="size-3" /> Detail
                {evidenceRefs.length > 0 && ` · ${evidenceRefs.length} evidence`}
              </>
            )}
          </button>

          {open && (
            <div id={bodyId}>
              {cluster.narrative && (
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {cluster.narrative}
                </p>
              )}
              {cluster.contested && (
                <div className="mt-3 border-l-2 border-warning pl-3 text-xs text-warning">
                  <span className="font-mono uppercase">Contested:</span>{" "}
                  {cluster.contested}
                </div>
              )}

              <EvidenceList
                refs={evidenceRefs}
                legacyQuotes={cluster.top_quotes ?? []}
                evidenceFallback={cluster.evidence}
              />

              {topDomains.length > 0 && (
                <p className="mt-3 font-mono text-[10px] text-text-tertiary">
                  Outlets represented: {topDomains.join(", ")}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function DecisionCue({ cluster }: { cluster: ReportClusterSummary }) {
  // Missing on legacy rows means the neutral monitor fallback, but stays
  // visually quiet rather than pretending an explicit action was assigned.
  if (!cluster.decision_status && !cluster.decision_reason) return null;
  const status = cluster.decision_status ?? "monitor";
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-2 border-border pl-3">
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.1em]",
          status === "escalate" && "text-destructive",
          status === "investigate" && "text-warning",
          status === "verify" && "text-text-secondary",
          status === "monitor" && "text-text-tertiary",
        )}
      >
        Action: {status}
      </span>
      {cluster.decision_reason && (
        <span className="text-xs leading-relaxed text-text-secondary">
          {cluster.decision_reason}
        </span>
      )}
    </div>
  );
}

function NarrativeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-elevated px-3 py-2">
      <dt className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function LifecycleBadge({ cluster }: { cluster: ReportClusterSummary }) {
  const lifecycle = cluster.lifecycle;
  if (!lifecycle) return null;
  const delta = lifecycle.share_delta;
  const label =
    lifecycle.status === "new"
      ? "new"
      : delta == null
        ? lifecycle.direction
        : `${lifecycle.direction} ${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}pp`;
  return (
    <span
      className={cn(
        "flex items-center gap-1 border border-border px-1.5 py-0.5 font-mono text-[9px]",
        lifecycle.direction === "growing" && "text-success",
        lifecycle.direction === "declining" && "text-warning",
        lifecycle.status === "new" && "text-foreground",
        lifecycle.direction === "stable" && "text-text-tertiary",
      )}
      title={
        lifecycle.match_score == null
          ? "Not matched to the previous comparable report"
          : `Matched to previous narrative (${Math.round(lifecycle.match_score * 100)}% similarity)`
      }
    >
      {lifecycle.direction === "growing" ? (
        <ArrowUpRight className="size-3" />
      ) : lifecycle.direction === "declining" ? (
        <ArrowDownRight className="size-3" />
      ) : (
        <ArrowRight className="size-3" />
      )}
      {label}
    </span>
  );
}

function MomentumBadge({ cluster }: { cluster: ReportClusterSummary }) {
  const tag = clusterMomentumTag(cluster);
  if (!tag) return null;
  const slope = clusterSlopeRatio(cluster);
  const title =
    slope == null
      ? "Within-window momentum; insufficient volume or day depth for a slope"
      : `Within-window second-half / first-half volume: ${slope.toFixed(2)}×`;

  if (tag === "spiking") {
    return (
      <span title={title} className="flex items-center gap-1 bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] text-warning">
        <Zap className="size-3" /> spiking
      </span>
    );
  }
  if (tag === "building") {
    return (
      <span title={title} className="flex items-center gap-1 bg-success/15 px-1.5 py-0.5 font-mono text-[10px] text-success">
        <TrendingUp className="size-3" /> building
      </span>
    );
  }
  if (tag === "fading") {
    return (
      <span title={title} className="flex items-center gap-1 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
        <TrendingDown className="size-3" /> fading
      </span>
    );
  }
  return (
    <span title={title} className="flex items-center gap-1 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
      <ArrowRight className="size-3" /> steady
    </span>
  );
}

function EvidenceList({
  refs,
  legacyQuotes,
  evidenceFallback,
}: {
  refs: ReportEvidenceRef[];
  legacyQuotes: string[];
  evidenceFallback: string | null | undefined;
}) {
  if (refs.length > 0) {
    return (
      <div className="mt-4 border-t border-border pt-3">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
          Evidence
        </h4>
        <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          {refs.map((ref, index) => (
            <EvidenceItem key={`${ref.mention_id}-${index}`} evidence={ref} />
          ))}
        </ul>
      </div>
    );
  }
  const fallbacks = legacyQuotes.length > 0 ? legacyQuotes : evidenceFallback ? [evidenceFallback] : [];
  if (fallbacks.length === 0) return null;
  return (
    <div className="mt-4 border-t border-border pt-3">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        Legacy extracted evidence
      </h4>
      <p className="mt-1 font-mono text-[9px] text-text-tertiary">
        Source link and verbatim verification were not stored for this report.
      </p>
      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-text-secondary">
        {fallbacks.map((text, index) => (
          <li key={index}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceItem({ evidence }: { evidence: ReportEvidenceRef }) {
  const url = safeExternalUrl(evidence.url);
  const verbatim = isVerbatimEvidence(evidence);
  const sourceText = evidenceRefText(evidence);
  const sourceLine = [
    evidence.domain,
    evidence.published_at ? formatUtcDate(evidence.published_at) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="border border-border bg-elevated p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
        <span>{verbatim ? "Verified direct quote" : "Source-backed paraphrase"}</span>
        <span>mention #{evidence.mention_id}</span>
      </div>
      <p className="text-xs leading-relaxed text-text-secondary">
        {verbatim ? `“${sourceText}”` : sourceText}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {evidence.title && (
            <p className="truncate text-[11px] text-text-secondary" title={evidence.title}>
              {evidence.title}
            </p>
          )}
          {sourceLine && (
            <p className="font-mono text-[9px] text-text-tertiary">{sourceLine}</p>
          )}
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 font-mono text-[9px] text-text-secondary underline-offset-2 hover:text-foreground hover:underline"
          >
            Source <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </li>
  );
}

function DepartedNarratives({
  rows,
}: {
  rows: NonNullable<ReportAggregates["departed_narratives"]>;
}) {
  return (
    <details className="mt-3 border border-border bg-card">
      <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] text-text-secondary hover:bg-elevated">
        Not observed since previous report ({rows.length})
      </summary>
      <ul className="border-t border-border px-3 py-2">
        {rows.map((row) => (
          <li key={row.narrative_id} className="flex justify-between gap-3 py-1 text-xs text-text-secondary">
            <span>{row.name}</span>
            <span className="font-mono text-text-tertiary">
              previous share {row.previous_share == null ? "—" : formatPercent(row.previous_share * 100)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function DataQualityPanel({ aggregates }: { aggregates: ReportAggregates | null }) {
  const selected = selectedReportBasis(aggregates);
  const corpus = corpusReportBasis(aggregates);
  const confidence = aggregates?.confidence;
  const quality = aggregates?.data_quality;
  if (!selected && !corpus && confidence == null && !quality) return null;

  const analyzed = selected?.analyzed_in_report ?? aggregates?.n_mentions ?? null;
  const clustered =
    selected?.clustered_in_report ?? selected?.clustered_mentions ?? null;
  const analysisCoverage = firstNumber(
    quality?.metrics?.selected_scope_coverage_pct,
    selected?.analysis_coverage_pct,
    percentOf(analyzed, selected?.relevant_total),
  );
  const embeddingCoverage = firstNumber(
    quality?.metrics?.embedding_coverage_pct,
    selected?.embedding_coverage_pct,
    percentOf(clustered, analyzed),
  );
  const evidenceCoverage = quality?.metrics?.evidence_coverage_pct;
  const enrichmentCoverage = firstNumber(
    corpus?.enrichment_coverage_pct,
    corpus?.coverage_pct,
    selected && !corpus ? selected.enrichment_coverage_pct : null,
    selected && !corpus ? selected.coverage_pct : null,
    percentOf(corpus?.enriched_total, corpus?.relevant_total),
  );
  const countryUnknown = firstNumber(
    selected?.country_unresolved_pct,
    corpus?.country_unresolved_pct,
    quality?.metrics?.country_resolved_pct == null
      ? null
      : 100 - quality.metrics.country_resolved_pct,
  );

  return (
    <section aria-labelledby="data-quality-heading" className="border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="data-quality-heading"
            className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary"
          >
            Confidence and data quality
          </h2>
          <p className="mt-1 text-xs text-text-tertiary">
            Coverage describes the report inputs; synthesis confidence is the model&rsquo;s assessment.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <DataQualityBadge quality={quality} />
          <ModelConfidenceBadge confidence={confidence} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-px bg-border lg:grid-cols-5">
        <QualityMetric
          label="Selected-scope analysis"
          value={analysisCoverage == null ? "—" : formatPercent(analysisCoverage)}
          detail={basisRatioDetail(analyzed, selected?.relevant_total, "relevant")}
        />
        <QualityMetric
          label="Embedding coverage"
          value={embeddingCoverage == null ? "—" : formatPercent(embeddingCoverage)}
          detail={basisRatioDetail(clustered, analyzed, "analyzed")}
        />
        <QualityMetric
          label="Evidence coverage"
          value={evidenceCoverage == null ? "—" : formatPercent(evidenceCoverage)}
          detail="Narratives with source-linked evidence"
        />
        <QualityMetric
          label="Corpus enrichment"
          value={enrichmentCoverage == null ? "—" : formatPercent(enrichmentCoverage)}
          detail={basisRatioDetail(corpus?.enriched_total, corpus?.relevant_total, "relevant")}
        />
        <QualityMetric
          label="Country unresolved"
          value={countryUnknown == null ? "—" : formatPercent(countryUnknown)}
          detail="Source-origin attribution"
        />
      </dl>

      {quality?.reasons && quality.reasons.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <h3 className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
            Why this grade
          </h3>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-text-secondary">
            {quality.reasons.map((reason, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden className="text-text-tertiary">—</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
          {(quality.version || quality.rubric_version) && (
            <p className="mt-2 font-mono text-[9px] text-text-tertiary">
              Rubric: {quality.version ?? quality.rubric_version}
            </p>
          )}
        </div>
      )}

      <BasisExclusions basis={selected ?? corpus} />
      {(selected?.note || corpus?.note) && (
        <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-text-tertiary">
          {selected?.note ?? corpus?.note}
        </p>
      )}
    </section>
  );
}

function DataQualityBadge({
  quality,
}: {
  quality: ReportAggregates["data_quality"] | undefined;
}) {
  if (!quality) {
    return (
      <span className="border border-border px-2 py-1 font-mono text-[10px] text-text-tertiary">
        Data quality not graded
      </span>
    );
  }
  const score = Math.round(
    Math.max(0, Math.min(100, quality.score <= 1 ? quality.score * 100 : quality.score)),
  );
  return (
    <span
      className={cn(
        "border px-2 py-1 font-mono text-[10px] capitalize",
        quality.grade === "high" && "border-success/40 bg-success/10 text-success",
        quality.grade === "moderate" && "border-warning/40 bg-warning/10 text-warning",
        quality.grade === "low" && "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      Data quality: {quality.grade} · {score}%
    </span>
  );
}

function ModelConfidenceBadge({ confidence }: { confidence: number | null | undefined }) {
  if (confidence == null) {
    return (
      <span className="border border-border px-2 py-1 font-mono text-[10px] text-text-tertiary">
        Model confidence unavailable
      </span>
    );
  }
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const label = pct >= 80 ? "high" : pct >= 60 ? "moderate" : "low";
  return (
    <span className="border border-strong bg-elevated px-2 py-1 font-mono text-[10px] text-text-secondary">
      Model confidence {pct}% · {label}
    </span>
  );
}

function QualityMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-elevated p-3">
      <dt className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg tabular-nums text-foreground">{value}</dd>
      <dd className="mt-1 text-[10px] text-text-tertiary">{detail}</dd>
    </div>
  );
}

function BasisExclusions({ basis }: { basis: ReportBasis | null }) {
  if (!basis) return null;
  const gate = basis.enrichment_gate ?? basis.gate;
  const exclusions = [
    ["Propaganda", basis.excluded_propaganda],
    ["Low tier", basis.excluded_low_tier],
    ["Aggregators", basis.excluded_aggregators],
    ["Reach gate", basis.excluded_reach_gate],
  ] as const;
  const visible = exclusions.filter(([, value]) => typeof value === "number" && value > 0);
  if (visible.length === 0 && basis.gate_excluded_total == null && !gate) return null;
  return (
    <div className="mt-3 border-t border-border pt-3 font-mono text-[10px] text-text-tertiary">
      {gate && (
        <p className="mb-2 text-text-secondary">
          Current enrichment gate: trust ≥ {gate.min_source_score ?? basis.enrichment_gate_min_score ?? "—"}
          {gate.min_reach_score != null ? ` · reach ≥ ${gate.min_reach_score} (trust 5 bypasses)` : ""}
          {gate.exclude_aggregators ? " · aggregators excluded" : ""}
          {gate.exclude_propaganda !== false ? " · propaganda excluded" : ""}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="uppercase tracking-[0.1em] text-text-secondary">Gate exclusions</span>
        {basis.gate_excluded_total != null && (
          <span>{formatNumber(basis.gate_excluded_total)} total</span>
        )}
        {visible.map(([label, value]) => (
          <span key={label}>{label}: {formatNumber(value ?? 0)}</span>
        ))}
        {basis.analyzed_outside_current_gate != null && basis.analyzed_outside_current_gate > 0 && (
          <span>{formatNumber(basis.analyzed_outside_current_gate)} analyzed outside current gate</span>
        )}
      </div>
    </div>
  );
}

function PerTopicPanel({ rows }: { rows: NonNullable<ReportAggregates["per_topic"]> }) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">
        Share of mentions by topic
      </h2>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const pct = Math.round(row.share_of_voice * 100);
          return (
            <div key={row.topic_id} className="flex items-center gap-3 font-mono text-xs">
              <span className="w-40 truncate text-text-secondary">
                {row.topic_name ?? `Topic ${row.topic_id}`}
              </span>
              <div
                className="h-3 flex-1 bg-muted"
                role="img"
                aria-label={`${row.topic_name ?? `Topic ${row.topic_id}`}: ${pct}% share, ${row.n} mentions`}
              >
                <div className="h-3 bg-foreground/70" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-24 text-right text-text-tertiary">{pct}% · {row.n}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const FRAMING_COLORS: Record<string, string> = {
  "pro-ukraine": "bg-success/60",
  "pro-russia": "bg-destructive/70",
  "neutral-factual": "bg-muted-foreground/40",
  "anti-western": "bg-destructive/50",
  whataboutism: "bg-warning/60",
  skeptical: "bg-warning/40",
  humanitarian: "bg-success/40",
  other: "bg-muted-foreground/25",
};

function FramingPanel({ dist }: { dist: Record<string, number> }) {
  const entries = Object.entries(dist).sort((left, right) => right[1] - left[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;
  const label = entries
    .map(([name, count]) => `${name} ${Math.round((count / total) * 100)}%`)
    .join(", ");
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">
        Framing distribution
      </h2>
      <div className="flex h-4 w-full overflow-hidden" role="img" aria-label={label}>
        {entries.map(([name, count]) => (
          <div
            key={name}
            className={cn("h-4", FRAMING_COLORS[name] ?? "bg-muted-foreground/25")}
            style={{ width: `${(count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-text-tertiary">
        {entries.map(([name, count]) => (
          <span key={name} className="flex items-center gap-1">
            <span aria-hidden className={cn("inline-block size-2", FRAMING_COLORS[name] ?? "bg-muted-foreground/25")} />
            {name} {Math.round((count / total) * 100)}%
          </span>
        ))}
      </div>
    </section>
  );
}

function StanceByCountryPanel({ rows }: { rows: StanceByCountryEntry[] }) {
  const visible = rows.slice(0, 12);
  return (
    <section>
      <h2 className="mb-1 font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">
        Stance by source country
      </h2>
      <p className="mb-3 text-[11px] text-text-tertiary">
        Source origin, not audience location. Showing {visible.length} of {rows.length} countries.
      </p>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="border-b border-border font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-normal">Country</th>
              <th scope="col" className="px-2 py-2 text-right font-normal">Mentions</th>
              <th scope="col" className="px-2 py-2 text-right font-normal">Outlets</th>
              <th scope="col" className="px-2 py-2 text-left font-normal">Stance mix</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">Dominant</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.country_iso2 ?? "unknown"} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2 font-mono text-text-secondary">
                  {row.country_iso2 ? (
                    <span title={countryName(row.country_iso2)}>{iso2ToFlagEmoji(row.country_iso2)} {row.country_iso2}</span>
                  ) : (
                    <span className="text-text-tertiary">Unknown</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right font-mono text-foreground">{row.n}</td>
                <td className="px-2 py-2 text-right font-mono text-text-tertiary">{row.n_publishers}</td>
                <td className="px-2 py-2"><StanceMiniBar values={row.stance_distribution} /></td>
                <td className="px-3 py-2 text-right">{row.dominant_stance ? <StanceBadge stance={row.dominant_stance} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PerMediaStancePanel({ rows }: { rows: PerMediaStanceEntry[] }) {
  const visible = rows.slice(0, 15);
  return (
    <section>
      <h2 className="mb-1 font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">
        Stance by outlet
      </h2>
      <p className="mb-3 text-[11px] text-text-tertiary">
        Showing {visible.length} of {rows.length} outlets by mention volume.
      </p>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="border-b border-border font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-normal">Outlet</th>
              <th scope="col" className="px-2 py-2 text-right font-normal">Mentions</th>
              <th scope="col" className="px-2 py-2 text-left font-normal">Tier</th>
              <th scope="col" className="px-2 py-2 text-left font-normal">Stance mix</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">Dominant</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.domain} className="border-b border-border last:border-b-0">
                <td className="max-w-60 truncate px-3 py-2 font-mono text-text-secondary">
                  {row.country_iso2 && <span className="mr-1">{iso2ToFlagEmoji(row.country_iso2)}</span>}
                  {row.domain}
                </td>
                <td className="px-2 py-2 text-right font-mono text-foreground">{row.n}</td>
                <td className="px-2 py-2 font-mono text-[10px] text-text-tertiary">{row.tier.replaceAll("_", " ")}</td>
                <td className="px-2 py-2"><StanceMiniBar values={row.stance_distribution} /></td>
                <td className="px-3 py-2 text-right">{row.dominant_stance ? <StanceBadge stance={row.dominant_stance} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StanceMiniBar({ values }: { values: Record<StanceLabel, number> }) {
  const total = Object.values(values).reduce((sum, count) => sum + count, 0);
  const label = (Object.keys(values) as StanceLabel[])
    .map((stance) => `${stance} ${total ? Math.round((values[stance] / total) * 100) : 0}%`)
    .join(", ");
  if (total === 0) return <div className="h-2 w-full bg-muted" aria-label="No stance data" />;
  return (
    <div className="flex h-2 min-w-16 w-full" role="img" aria-label={label}>
      <div className="bg-success/60" style={{ width: `${(values.supportive / total) * 100}%` }} />
      <div className="bg-destructive/60" style={{ width: `${(values.critical / total) * 100}%` }} />
      <div className="bg-muted-foreground/40" style={{ width: `${(values.neutral / total) * 100}%` }} />
      <div className="bg-warning/60" style={{ width: `${(values.mixed / total) * 100}%` }} />
    </div>
  );
}

function StanceWeightedPanel({
  label,
  values,
}: {
  label: string;
  values: Record<StanceLabel, number>;
}) {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return (
    <div className="border border-border bg-card p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">{label}</h3>
      {total === 0 ? (
        <p className="text-xs text-text-tertiary">No stance attribution in segment.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {(Object.keys(values) as StanceLabel[]).map((stance) => (
            <StanceBar key={stance} stance={stance} fraction={values[stance]} />
          ))}
        </div>
      )}
    </div>
  );
}

function StanceBar({ stance, fraction }: { stance: StanceLabel; fraction: number }) {
  const pct = Math.round(fraction * 100);
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span className="w-20 capitalize text-text-secondary">{stance}</span>
      <div className="h-2 flex-1 bg-muted" role="img" aria-label={`${stance}: ${pct}%`}>
        <div className={cn("h-2", STANCE_COLORS[stance])} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-text-tertiary">{pct}%</span>
    </div>
  );
}

function TierBreakdownPanel({
  tiers,
  showStance,
}: {
  tiers: Record<string, { n: number; dominant_stance: StanceLabel | null }>;
  showStance: boolean;
}) {
  const entries = Object.entries(tiers ?? {})
    .filter(([, value]) => value.n > 0)
    .sort((left, right) => right[1].n - left[1].n);
  return (
    <div className="border border-border bg-card p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">Source tier breakdown</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-text-tertiary">No tier classification.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
            <tr>
              <th scope="col" className="py-1 text-left font-normal">Tier</th>
              <th scope="col" className="py-1 text-right font-normal">Mentions</th>
              {showStance && <th scope="col" className="py-1 text-right font-normal">Dominant stance</th>}
            </tr>
          </thead>
          <tbody>
            {entries.map(([tier, info]) => (
              <tr key={tier} className="border-b border-border last:border-b-0">
                <td className="py-2 font-mono text-text-secondary">{tier.replaceAll("_", " ")}</td>
                <td className="py-2 text-right font-mono text-foreground">{info.n}</td>
                {showStance && (
                  <td className="py-2 pl-2 text-right">{info.dominant_stance ? <StanceBadge stance={info.dominant_stance} /> : "—"}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TimelinePanel({
  timeline,
}: {
  timeline: { date: string; n: number; dominant_stance: StanceLabel | null }[];
}) {
  const max = Math.max(...timeline.map((day) => day.n), 1);
  const label = timeline.map((day) => `${day.date}: ${day.n}`).join(", ");
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">Daily mention volume</h2>
      <div className="flex h-36 items-end gap-1" role="img" aria-label={label}>
        {timeline.map((day) => (
          <div key={day.date} className="group flex h-full flex-1 flex-col items-center gap-1" title={`${day.date}: ${day.n} mentions`}>
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn("w-full", day.dominant_stance ? STANCE_COLORS[day.dominant_stance] : "bg-muted")}
                style={{ height: `${(day.n / max) * 100}%`, minHeight: day.n > 0 ? 2 : 0 }}
              />
            </div>
            <span className="font-mono text-[9px] text-text-tertiary">{day.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StanceBadge({ stance }: { stance: StanceLabel }) {
  return (
    <span className={cn("inline-block px-1.5 py-0.5 font-mono text-[10px] capitalize", STANCE_COLORS[stance])}>
      {stance}
    </span>
  );
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-1 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

function PendingPane({ status }: { status: "pending" | "running" }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-border p-12 text-center">
      <Loader2 className="size-6 animate-spin text-text-tertiary" />
      <p className="font-mono text-xs text-text-secondary">Report {status}…</p>
      <p className="font-mono text-[11px] text-text-tertiary">
        Mapping narratives, verifying evidence, and reducing the brief. This usually takes 15–60 seconds.
      </p>
    </div>
  );
}

function ErrorPane({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" />
        <h3 className="font-mono text-sm text-destructive">{title}</h3>
      </div>
      <p className="font-mono text-xs text-text-secondary">{detail}</p>
      {onRetry && (
        <button
          type="button"
          className="self-start font-mono text-xs text-text-secondary underline hover:text-foreground"
          onClick={onRetry}
        >
          Reload
        </button>
      )}
    </div>
  );
}

function resolveScopeLabel(report: Report): { label: string; kind: string } {
  const scope = report.aggregates?.scope;
  if (scope?.label) {
    return { label: scope.label, kind: scope.is_group ? "Topic group" : "Topic" };
  }
  if (report.group_id) return { label: `Group ${report.group_id}`, kind: "Topic group" };
  if (report.topic_id) return { label: `Topic ${report.topic_id}`, kind: "Topic" };
  const topicIds = report.topic_ids ?? [];
  return {
    label: topicIds.length ? `Topics ${topicIds.join(", ")}` : "Report scope",
    kind: topicIds.length > 1 ? "Topic union" : "Topic",
  };
}

function nextUtcDay(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function sumClusterMentions(clusters: ReportClusterSummary[]): number {
  return clusters.reduce((sum, cluster) => sum + cluster.n_mentions, 0);
}

function percentOf(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return Math.max(0, (numerator / denominator) * 100);
}

function firstNumber(...values: Array<number | null | undefined>): number | null {
  return values.find((value): value is number => typeof value === "number" && Number.isFinite(value)) ?? null;
}

function basisRatioDetail(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  denominatorLabel: string,
): string {
  if (numerator == null || denominator == null) return "Not available on this report";
  return `${formatNumber(numerator)} of ${formatNumber(denominator)} ${denominatorLabel}`;
}

function formatNumber(value: number): string {
  // No locale dependency: avoids SSR/client punctuation differences.
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatPercent(value: number): string {
  const safe = Math.max(0, Math.min(100, value));
  const rounded = Math.round(safe * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}
