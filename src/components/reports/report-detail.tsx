"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

import { apiClient } from "@/lib/api";
import { countryName, iso2ToFlagEmoji } from "@/lib/country";
import type {
  DigestResultDetail,
  PerMediaStanceEntry,
  Report,
  ReportAggregates,
  ReportClusterSummary,
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

// Pull-based polling for pending reports — TanStack handles the
// refetch interval cleanly. 2s is responsive without hammering the
// backend; the server's BackgroundTask typically finishes in 15-60s.
const POLL_INTERVAL_MS = 2000;

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
  if (error)
    return (
      <ErrorPane title="Failed to load report" detail={(error as Error).message} />
    );
  if (!data) return null;

  if (data.status === "pending" || data.status === "running") {
    return <PendingPane status={data.status} />;
  }
  if (data.status === "failed") {
    return (
      <ErrorPane
        title="Report generation failed"
        detail={data.error ?? "unknown error"}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ReportHeader report={data} />
      <ReportBody
        narrative={data.narrative}
        clusters={data.clusters ?? []}
        aggregates={data.aggregates}
        errorNote={data.error}
      />
    </div>
  );
}

// Scheduled-report run detail — same body component as ad-hoc reports
// (one render path for both surfaces). Legacy rows written before the
// digest_result.aggregates column carry partial data; assemble what we
// can from the dedicated columns.
export function DigestResultView({ result }: { result: DigestResultDetail }) {
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
        }
      : null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-mono text-sm text-foreground">
            Scheduled run · {result.period_start.slice(0, 10)}
          </h1>
          <span className="font-mono text-xs text-text-tertiary">
            {result.n_mentions} mentions · {result.clusters?.length ?? 0}{" "}
            narratives · {result.model}
          </span>
        </div>
        <span className="font-mono text-xs text-text-tertiary">
          generated {new Date(result.created_at).toLocaleString()}
        </span>
      </div>
      <ReportBody
        narrative={result.narrative || null}
        clusters={result.clusters ?? []}
        aggregates={aggregates}
        errorNote={null}
      />
    </div>
  );
}

// ---------- shared body (ad-hoc Report + scheduled DigestResult) ----------

export function ReportBody({
  narrative,
  clusters,
  aggregates,
  errorNote,
}: {
  narrative: string | null;
  clusters: ReportClusterSummary[];
  aggregates: ReportAggregates | null;
  errorNote: string | null;
}) {
  const isGroup = aggregates?.scope?.is_group ?? false;
  return (
    <>
      {errorNote && (
        <div className="border-l-2 border-warning bg-warning/10 px-4 py-2 text-sm text-warning">
          Partial result: {errorNote}
        </div>
      )}

      {aggregates?.data_basis && <DataBasisBar basis={aggregates.data_basis} />}

      {isGroup && aggregates?.per_topic && aggregates.per_topic.length > 0 && (
        <PerTopicPanel rows={aggregates.per_topic} />
      )}

      {isGroup &&
        aggregates?.framing_distribution &&
        Object.keys(aggregates.framing_distribution).length > 0 && (
          <FramingPanel dist={aggregates.framing_distribution} />
        )}

      {narrative ? (
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
            Narrative
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {narrative}
          </p>
        </section>
      ) : (
        <p className="text-sm text-text-tertiary italic">
          No narrative produced (zero clusters or LLM degraded).
        </p>
      )}

      {clusters.length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
            Narratives ({clusters.length})
          </h2>
          <div className="flex flex-col gap-3">
            {clusters.map((c) => (
              <NarrativeCard key={c.cluster_id} cluster={c} />
            ))}
          </div>
        </section>
      )}

      {aggregates && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Publisher-weighted stance is per-target — undefined across a
              group's heterogeneous topics, so hidden for groups (framing
              + per-topic panels carry the group-level signal instead). */}
          {!isGroup && (
            <StanceWeightedPanel
              label="Publisher-weighted stance"
              values={aggregates.publisher_weighted_stance}
            />
          )}
          <TierBreakdownPanel tiers={aggregates.tier_breakdown} />
        </section>
      )}

      {aggregates?.stance_by_country && aggregates.stance_by_country.length > 0 && (
        <StanceByCountryPanel rows={aggregates.stance_by_country} />
      )}

      {aggregates?.per_media_stance && aggregates.per_media_stance.length > 0 && (
        <PerMediaStancePanel rows={aggregates.per_media_stance} />
      )}

      {aggregates?.recency_timeline && aggregates.recency_timeline.length > 0 && (
        <TimelinePanel timeline={aggregates.recency_timeline} />
      )}
    </>
  );
}

function ReportHeader({ report }: { report: Report }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-mono text-sm text-foreground">
          Report #{report.id}
        </h1>
        <span className="font-mono text-xs text-text-tertiary">
          {report.n_mentions ?? 0} mentions · {report.clusters?.length ?? 0}{" "}
          narratives
          {report.cached && " · cached"}
          {report.model && ` · ${report.model}`}
        </span>
      </div>
      <span className="font-mono text-xs text-text-tertiary">
        {new Date(report.created_at).toLocaleString()}
      </span>
    </div>
  );
}

// ---------- narrative card ----------

function NarrativeCard({ cluster }: { cluster: ReportClusterSummary }) {
  const title =
    cluster.name || cluster.label || `Narrative ${cluster.cluster_id + 1}`;
  const sharePct =
    cluster.share_of_voice != null
      ? Math.round(cluster.share_of_voice * 100)
      : null;
  const countries = Object.entries(cluster.countries ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <article className="border border-border bg-card p-4">
      <header className="mb-2 flex items-start justify-between gap-2 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="text-sm text-foreground">{title}</h3>
          <span className="font-mono text-[11px] text-text-tertiary">
            {sharePct !== null && `${sharePct}% share · `}
            {cluster.n_mentions} mentions · {cluster.n_publishers} publishers
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MomentumBadge momentum={cluster.momentum} />
          {cluster.dominant_stance && (
            <span
              className={cn(
                "inline-block px-1.5 py-0.5 font-mono text-[10px] capitalize",
                STANCE_COLORS[cluster.dominant_stance],
              )}
            >
              {cluster.dominant_stance}
            </span>
          )}
        </div>
      </header>
      {countries.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-text-tertiary">
          <span className="uppercase tracking-[0.1em]">Pushed by</span>
          {countries.map(([iso, n]) => (
            <span
              key={iso}
              className="border border-border bg-elevated px-1.5 py-0.5 text-text-secondary"
              title={countryName(iso)}
            >
              {iso2ToFlagEmoji(iso)} {iso} · {n}
            </span>
          ))}
        </div>
      )}
      {cluster.narrative && (
        <p className="mb-3 text-sm leading-relaxed text-text-secondary">
          {cluster.narrative}
        </p>
      )}
      {cluster.contested && (
        <div className="mb-2 border-l-2 border-warning pl-2 text-xs italic text-warning">
          Contested: {cluster.contested}
        </div>
      )}
      {cluster.top_quotes.length > 0 && (
        <ul className="mb-2 ml-4 list-disc text-xs text-text-secondary">
          {cluster.top_quotes.map((q, i) => (
            <li key={i} className="italic">
              “{q}”
            </li>
          ))}
        </ul>
      )}
      {cluster.top_domains.length > 0 && (
        <div className="font-mono text-[10px] text-text-tertiary">
          Top: {cluster.top_domains.join(", ")}
        </div>
      )}
    </article>
  );
}

function MomentumBadge({
  momentum,
}: {
  momentum: "rising" | "flat" | "falling" | null | undefined;
}) {
  if (momentum === "rising") {
    return (
      <span className="flex items-center gap-1 bg-success/15 px-1.5 py-0.5 font-mono text-[10px] text-success">
        <TrendingUp className="size-3" /> rising
      </span>
    );
  }
  if (momentum === "falling") {
    return (
      <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        <TrendingDown className="size-3" /> falling
      </span>
    );
  }
  return null; // flat / unknown → no badge, keep the card quiet
}

// ---------- topic-groups + honesty panels ----------

function DataBasisBar({ basis }: { basis: NonNullable<ReportAggregates["data_basis"]> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-border bg-card px-4 py-2 font-mono text-[10px] text-text-tertiary">
      <span className="uppercase tracking-[0.1em] text-text-secondary">
        Data basis
      </span>
      <span>
        <span className="text-foreground">{basis.analyzed_in_report}</span> analyzed
      </span>
      <span>
        of <span className="text-foreground">{basis.relevant_total}</span> collected (
        {basis.coverage_pct}%)
      </span>
      {basis.excluded_propaganda > 0 && (
        <span>· {basis.excluded_propaganda} propaganda excluded</span>
      )}
      {basis.excluded_low_tier > 0 && (
        <span>· {basis.excluded_low_tier} low-tier excluded</span>
      )}
      {basis.country_unresolved_pct > 0 && (
        <span>· {basis.country_unresolved_pct}% country-unknown</span>
      )}
    </div>
  );
}

function PerTopicPanel({
  rows,
}: {
  rows: NonNullable<ReportAggregates["per_topic"]>;
}) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
        Share of voice by topic
      </h2>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const pct = Math.round(r.share_of_voice * 100);
          return (
            <div
              key={r.topic_id}
              className="flex items-center gap-3 font-mono text-xs"
            >
              <span className="w-40 truncate text-text-secondary">
                {r.topic_name ?? `topic ${r.topic_id}`}
              </span>
              <div className="flex-1 h-3 bg-muted">
                <div
                  className="h-3 bg-foreground/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-24 text-right text-text-tertiary">
                {pct}% · {r.n}
              </span>
              {r.dominant_stance && (
                <span
                  className={cn(
                    "w-20 px-1.5 py-0.5 text-center text-[10px] capitalize",
                    STANCE_COLORS[r.dominant_stance],
                  )}
                >
                  {r.dominant_stance}
                </span>
              )}
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
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
        Framing distribution
      </h2>
      {/* Stacked bar — framing is the group-level headline axis. */}
      <div className="flex h-4 w-full overflow-hidden">
        {entries.map(([label, n]) => (
          <div
            key={label}
            className={cn("h-4", FRAMING_COLORS[label] ?? "bg-muted-foreground/25")}
            style={{ width: `${(n / total) * 100}%` }}
            title={`${label}: ${n}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-text-tertiary">
        {entries.map(([label, n]) => (
          <span key={label} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-block size-2",
                FRAMING_COLORS[label] ?? "bg-muted-foreground/25",
              )}
            />
            {label} {Math.round((n / total) * 100)}%
          </span>
        ))}
      </div>
    </section>
  );
}

// ---------- PR1 panels: country + media sentiment ----------

function StanceByCountryPanel({ rows }: { rows: StanceByCountryEntry[] }) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
        Sentiment by source country
      </h2>
      <div className="border border-border bg-card">
        <table className="w-full text-xs">
          <tbody>
            {rows.slice(0, 12).map((row) => (
              <tr
                key={row.country_iso2 ?? "unknown"}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-3 py-2 font-mono text-text-secondary">
                  {row.country_iso2 ? (
                    <span title={countryName(row.country_iso2)}>
                      {iso2ToFlagEmoji(row.country_iso2)} {row.country_iso2}
                    </span>
                  ) : (
                    <span className="text-text-tertiary">unknown</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right font-mono text-foreground">
                  {row.n}
                </td>
                <td className="px-2 py-2 text-right font-mono text-text-tertiary">
                  {row.n_publishers} outlets
                </td>
                <td className="px-2 py-2">
                  <StanceMiniBar values={row.stance_distribution} />
                </td>
                <td className="px-3 py-2 text-right">
                  {row.dominant_stance ? (
                    <span
                      className={cn(
                        "inline-block px-1.5 py-0.5 font-mono text-[10px] capitalize",
                        STANCE_COLORS[row.dominant_stance],
                      )}
                    >
                      {row.dominant_stance}
                    </span>
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PerMediaStancePanel({ rows }: { rows: PerMediaStanceEntry[] }) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
        Sentiment by outlet
      </h2>
      <div className="border border-border bg-card">
        <table className="w-full text-xs">
          <tbody>
            {rows.slice(0, 15).map((row) => (
              <tr
                key={row.domain}
                className="border-b border-border last:border-b-0"
              >
                <td className="max-w-0 truncate px-3 py-2 font-mono text-text-secondary">
                  {row.country_iso2 && (
                    <span className="mr-1">
                      {iso2ToFlagEmoji(row.country_iso2)}
                    </span>
                  )}
                  {row.domain}
                </td>
                <td className="px-2 py-2 text-right font-mono text-foreground">
                  {row.n}
                </td>
                <td className="px-2 py-2 font-mono text-[10px] text-text-tertiary">
                  {row.tier.replace(/_/g, " ")}
                </td>
                <td className="px-2 py-2">
                  <StanceMiniBar values={row.stance_distribution} />
                </td>
                <td className="px-3 py-2 text-right">
                  {row.dominant_stance ? (
                    <span
                      className={cn(
                        "inline-block px-1.5 py-0.5 font-mono text-[10px] capitalize",
                        STANCE_COLORS[row.dominant_stance],
                      )}
                    >
                      {row.dominant_stance}
                    </span>
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Tiny inline stacked bar: supportive/critical/neutral/mixed shares.
function StanceMiniBar({ values }: { values: Record<StanceLabel, number> }) {
  const total =
    (values.supportive ?? 0) +
    (values.critical ?? 0) +
    (values.neutral ?? 0) +
    (values.mixed ?? 0);
  if (total === 0) {
    return <div className="h-2 w-full bg-muted" />;
  }
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2 w-full min-w-16">
      <div className="bg-success/60" style={{ width: seg(values.supportive ?? 0) }} />
      <div className="bg-destructive/60" style={{ width: seg(values.critical ?? 0) }} />
      <div className="bg-muted-foreground/40" style={{ width: seg(values.neutral ?? 0) }} />
      <div className="bg-warning/60" style={{ width: seg(values.mixed ?? 0) }} />
    </div>
  );
}

// ---------- aggregate panels (pre-existing) ----------

function StanceWeightedPanel({
  label,
  values,
}: {
  label: string;
  values: Record<StanceLabel, number>;
}) {
  const total = Object.values(values).reduce((a, b) => a + b, 0);
  return (
    <div className="border border-border bg-card p-4">
      <h3 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
        {label}
      </h3>
      {total === 0 ? (
        <p className="text-xs text-text-tertiary">
          No stance attribution in segment.
        </p>
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
      <span className="w-20 text-text-secondary capitalize">{stance}</span>
      <div className="flex-1 h-2 bg-muted">
        <div
          className={cn("h-2", STANCE_COLORS[stance])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-text-tertiary">{pct}%</span>
    </div>
  );
}

function TierBreakdownPanel({
  tiers,
}: {
  tiers: Record<string, { n: number; dominant_stance: StanceLabel | null }>;
}) {
  const entries = Object.entries(tiers ?? {})
    .filter(([, v]) => v.n > 0)
    .sort((a, b) => b[1].n - a[1].n);
  return (
    <div className="border border-border bg-card p-4">
      <h3 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
        Tier breakdown
      </h3>
      {entries.length === 0 ? (
        <p className="text-xs text-text-tertiary">No tier classification.</p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {entries.map(([tier, info]) => (
              <tr key={tier} className="border-b border-border last:border-b-0">
                <td className="py-2 font-mono text-text-secondary">
                  {tier.replace("_", " ")}
                </td>
                <td className="py-2 text-right font-mono text-foreground">
                  {info.n}
                </td>
                <td className="py-2 pl-2 text-right">
                  {info.dominant_stance ? (
                    <span
                      className={cn(
                        "inline-block px-1.5 py-0.5 font-mono text-[10px] capitalize",
                        STANCE_COLORS[info.dominant_stance],
                      )}
                    >
                      {info.dominant_stance}
                    </span>
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </td>
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
  const max = Math.max(...timeline.map((d) => d.n), 1);
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
        Daily volume
      </h2>
      <div className="flex items-end gap-1 h-32">
        {timeline.map((d) => {
          const heightPct = (d.n / max) * 100;
          return (
            <div
              key={d.date}
              className="flex flex-1 flex-col items-center gap-1 group"
              title={`${d.date}: ${d.n} mentions${d.dominant_stance ? ` (${d.dominant_stance})` : ""}`}
            >
              <div className="flex-1 w-full flex items-end">
                <div
                  className={cn(
                    "w-full",
                    d.dominant_stance
                      ? STANCE_COLORS[d.dominant_stance]
                      : "bg-muted",
                  )}
                  style={{ height: `${heightPct}%`, minHeight: d.n > 0 ? 2 : 0 }}
                />
              </div>
              <span className="font-mono text-[9px] text-text-tertiary rotate-45 origin-top-left">
                {d.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- skeletons / placeholders ----------

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-32" />
      <Skeleton className="h-48" />
    </div>
  );
}

function PendingPane({ status }: { status: "pending" | "running" }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-border p-12 text-center">
      <Loader2 className="size-6 animate-spin text-text-tertiary" />
      <p className="font-mono text-xs text-text-secondary">
        Report {status}…
      </p>
      <p className="font-mono text-[11px] text-text-tertiary">
        Map-reduce pipeline runs in the background. Typically 15–60s.
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
          className="self-start font-mono text-xs underline text-text-secondary hover:text-foreground"
          onClick={onRetry}
        >
          retry
        </button>
      )}
    </div>
  );
}
