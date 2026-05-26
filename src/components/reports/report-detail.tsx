"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";

import { apiClient } from "@/lib/api";
import type { Report, ReportClusterSummary, StanceLabel } from "@/lib/types";
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

  // Force one immediate refetch after the cached data flips to a
  // terminal status — avoids waiting one full poll cycle for the FE
  // to render the final payload.
  useEffect(() => {
    if (data?.status === "success" || data?.status === "failed") {
      // no-op — polling will stop on its own; placeholder for future
      // toast-on-completion hook
    }
  }, [data?.status]);

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

  return <SuccessReport report={data} />;
}

// ---------- success ----------

function SuccessReport({ report }: { report: Report }) {
  const aggregates = report.aggregates;
  const clusters = report.clusters ?? [];

  return (
    <div className="flex flex-col gap-8">
      <ReportHeader report={report} />
      {report.error && (
        <div className="border-l-2 border-warning bg-warning/10 px-4 py-2 text-sm text-warning">
          Partial result: {report.error}
        </div>
      )}

      {report.narrative ? (
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
            Narrative
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {report.narrative}
          </p>
        </section>
      ) : (
        <p className="text-sm text-text-tertiary italic">
          No narrative produced (zero clusters or LLM degraded).
        </p>
      )}

      {aggregates && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <StanceWeightedPanel
            label="Publisher-weighted stance"
            values={aggregates.publisher_weighted_stance}
          />
          <TierBreakdownPanel tiers={aggregates.tier_breakdown} />
        </section>
      )}

      {aggregates?.recency_timeline && aggregates.recency_timeline.length > 0 && (
        <TimelinePanel timeline={aggregates.recency_timeline} />
      )}

      {clusters.length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase text-text-tertiary">
            Clusters ({clusters.length})
          </h2>
          <div className="flex flex-col gap-3">
            {clusters.map((c) => (
              <ClusterCard key={c.cluster_id} cluster={c} />
            ))}
          </div>
        </section>
      )}
    </div>
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
          {report.n_mentions ?? 0} mentions · {report.clusters?.length ?? 0} clusters
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
            <StanceBar
              key={stance}
              stance={stance}
              fraction={values[stance]}
            />
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
  tiers: Record<
    string,
    { n: number; dominant_stance: StanceLabel | null }
  >;
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

function ClusterCard({ cluster }: { cluster: ReportClusterSummary }) {
  return (
    <article className="border border-border bg-card p-4">
      <header className="mb-2 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-mono text-sm text-foreground">
          {cluster.label || `Cluster ${cluster.cluster_id}`}
        </h3>
        <span className="font-mono text-xs text-text-tertiary">
          {cluster.n_mentions} mentions · {cluster.n_publishers} publishers
          {cluster.dominant_stance && (
            <span
              className={cn(
                "ml-2 inline-block px-1.5 py-0.5 capitalize",
                STANCE_COLORS[cluster.dominant_stance],
              )}
            >
              {cluster.dominant_stance}
            </span>
          )}
        </span>
      </header>
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
