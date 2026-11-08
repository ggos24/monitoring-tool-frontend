"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { FAVORABILITY_TOOLTIP, favorabilityReadiness } from "@/lib/favorability";
import { computeTrend, formatDayLabel, formatPpDelta, type DateWindow } from "@/lib/period";
import type { CampaignFavorability, CampaignHeadline, ScopeParam } from "@/lib/types";
import { countryName, iso2ToFlagEmoji } from "@/lib/country";
import { KickerLabel } from "@/components/ui/kicker-label";
import { KpiCard } from "./kpi-card";
import { CountDelta } from "./top-geo-card";
import { isNotFound, useCampaignCoverage } from "./campaign-data";

/**
 * Headline KPIs from /api/campaign/headline — GKG v1 axis A/B articles only
 * (PLAN §9), not the generic endpoints, which mix DOC + GN + RSS rows.
 * One call per window; both pass the coverage selector version verbatim.
 * `fallback` renders when the backend has no campaign endpoint (404).
 */
export function CampaignKpiGrid({
  compare,
  scope,
  win,
  country,
  fallback,
}: {
  compare: boolean;
  scope: ScopeParam | null;
  win: DateWindow;
  country: string | null;
  fallback: React.ReactNode;
}) {
  const coverage = useCampaignCoverage();
  // Wait for coverage to settle so the first headline call already carries
  // the selector version (no second request when it arrives).
  const coverageSettled = coverage.isSuccess || coverage.isError;
  const selector = coverage.data?.selector_version ?? null;

  const fetchWindow = (from: string, to: string, on: boolean) => ({
    queryKey: ["campaign-headline", scope, country, selector, from, to],
    queryFn: () =>
      apiClient.campaignHeadline(scope!, {
        date_from: from,
        date_to: to,
        selector_version: selector,
        country_iso2: country,
      }),
    enabled: scope !== null && coverageSettled && on,
    retry: (count: number, error: unknown) => !isNotFound(error) && count < 1,
  });
  const current = useQuery(fetchWindow(win.from, win.to, true));
  const previous = useQuery(fetchWindow(win.prevFrom, win.prevTo, compare));

  if (isNotFound(current.error)) return <>{fallback}</>;

  const loading = scope === null || !coverageSettled || current.isLoading;
  const cur = current.data;
  const prev = compare ? previous.data : undefined;

  if (current.error) {
    return <GridMessage tone="error">Failed to load campaign figures: {(current.error as Error).message}</GridMessage>;
  }
  if (cur?.headline.mixed_selector_versions || prev?.headline.mixed_selector_versions) {
    return (
      <GridMessage tone="error">
        This period mixes GKG selector versions ({Object.keys(cur?.headline.selector_versions ?? {}).join(", ") || "unknown"}),
        so its figures are not comparable. Pick a period measured by a single selector.
      </GridMessage>
    );
  }

  const ingest = ingestState(cur, win);
  if (ingest.kind === "none") {
    return (
      <GridMessage tone="muted">
        Live data not ingested yet for {win.label}
        {ingest.through ? ` — GKG ingested through ${formatDayLabel(ingest.through)}.` : "."}
      </GridMessage>
    );
  }

  const h = cur?.headline;
  const ph = prev?.headline;
  const trendTitle = `vs ${win.prevLabel}`;
  const prevSuffix = (v: string | undefined) => (prev && v !== undefined ? ` · ${win.prevLabel} ${v}` : "");
  const partial =
    ingest.kind === "partial" ? ` · ingested through ${formatDayLabel(ingest.through)}` : "";

  const fav = favorableShare(h?.favorability);
  const favPrev = favorableShare(ph?.favorability);
  const countries = h?.countries;

  return (
    <div className={`grid grid-cols-2 gap-px bg-strong md:grid-cols-3 ${countries ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
      <KpiCard
        kicker="Tier-1 articles"
        title="GKG v1 selection, axes A/B — each article counted once"
        value={(h?.articles ?? 0).toLocaleString()}
        subtitle={win.label + prevSuffix(ph?.articles.toLocaleString()) + partial}
        trend={prev ? computeTrend(h?.articles, ph?.articles) : undefined}
        trendTitle={trendTitle}
        isLoading={loading}
      />
      <KpiCard
        kicker="Share of Tier-1 coverage"
        value={h?.pool_share == null ? "—" : formatShare(h.pool_share)}
        subtitle={
          h?.pool_articles == null
            ? "Tier-1 pool not available"
            : `of ${h.pool_articles.toLocaleString()} Tier-1 articles` +
              prevSuffix(ph?.pool_share == null ? undefined : formatShare(ph.pool_share))
        }
        delta={
          prev && h?.pool_share != null && ph?.pool_share != null
            ? formatPpDelta(h.pool_share, ph.pool_share)
            : undefined
        }
        trendTitle={trendTitle}
        isLoading={loading}
      />
      <KpiCard
        kicker="Favorable share"
        title={FAVORABILITY_TOOLTIP}
        value={fav.value === null ? "n/a" : formatShare(fav.value)}
        subtitle={fav.note}
        delta={
          prev && fav.value !== null && favPrev.value !== null
            ? formatPpDelta(fav.value, favPrev.value)
            : undefined
        }
        trendTitle={trendTitle}
        isLoading={loading}
      />
      <KpiCard
        kicker="Outlets"
        value={(h?.outlets ?? 0).toLocaleString()}
        subtitle={"distinct Tier-1 outlets" + prevSuffix(ph?.outlets.toLocaleString())}
        trend={prev ? computeTrend(h?.outlets, ph?.outlets) : undefined}
        trendTitle={trendTitle}
        isLoading={loading}
      />
      {countries && (
        <CountriesCard
          rows={countries}
          previous={ph?.countries}
          win={win}
        />
      )}
    </div>
  );
}

/**
 * none    — nothing ingested for this window yet (show a message, not 0);
 * partial — ingest stops inside the window (numbers are a floor);
 * ok      — fully ingested, or the backend doesn't report the stamp.
 */
function ingestState(
  cur: CampaignHeadline | undefined,
  win: DateWindow,
): { kind: "ok" } | { kind: "none"; through: string | null } | { kind: "partial"; through: string } {
  if (!cur || cur.last_ingested_at === undefined) return { kind: "ok" };
  const through = cur.last_ingested_at;
  if (through === null || through < win.from) {
    return cur.headline.articles === 0 ? { kind: "none", through } : { kind: "ok" };
  }
  return through < win.to ? { kind: "partial", through } : { kind: "ok" };
}

/**
 * Favorable ÷ scored. While enrichment is off most rows are unscored, so the
 * share is only shown once enough articles are scored (favorabilityReadiness:
 * backend `sufficient` flag, or ≥20 scored and ≥half of all) — else "n/a".
 */
function favorableShare(f: CampaignFavorability | undefined): { value: number | null; note: string } {
  if (!f) return { value: null, note: "" };
  const scored = f.favorable + f.neutral + f.unfavorable + f.mixed;
  const note = `${scored.toLocaleString()} scored · ${f.unscored.toLocaleString()} unscored`;
  if (scored === 0 || !favorabilityReadiness(f, f).ready) {
    return { value: null, note: `${note} — too few scored` };
  }
  return { value: f.favorable / scored, note };
}

function formatShare(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function CountriesCard({
  rows,
  previous,
  win,
}: {
  rows: { iso2: string | null; count: number }[];
  previous: { iso2: string | null; count: number }[] | undefined;
  win: DateWindow;
}) {
  const total = rows.reduce((sum, c) => sum + c.count, 0);
  const prevByIso = new Map((previous ?? []).map((c) => [c.iso2, c.count] as const));
  const top = rows.filter((c) => c.iso2).slice(0, 3);
  return (
    <div className="bg-card p-5">
      <KickerLabel>Top countries</KickerLabel>
      {top.length === 0 ? (
        <div className="mt-3 font-mono text-[11px] text-text-tertiary">No country data yet.</div>
      ) : (
        <div className="mt-3 space-y-2">
          {top.map((c) => (
            <div key={c.iso2} className="flex items-center gap-2">
              <span aria-hidden className="text-[14px] leading-none">{iso2ToFlagEmoji(c.iso2!)}</span>
              <span className="flex-1 truncate text-xs text-text-secondary">{countryName(c.iso2!)}</span>
              <span className="font-mono text-[11px] tabular-nums text-foreground">{c.count.toLocaleString()}</span>
              {previous ? (
                <CountDelta current={c.count} previous={prevByIso.get(c.iso2) ?? 0} title={`vs ${win.prevLabel}`} />
              ) : (
                <span className="w-9 text-right font-mono text-[11px] tabular-nums text-text-tertiary">
                  {total > 0 ? Math.round((c.count / total) * 100) : 0}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 font-mono text-[11px] text-text-tertiary">by articles, {win.label}</div>
    </div>
  );
}

function GridMessage({ tone, children }: { tone: "error" | "muted"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "border border-danger/40 bg-card px-5 py-6 font-mono text-[11px] text-danger"
          : "border border-border bg-card px-5 py-6 font-mono text-[11px] text-text-tertiary"
      }
    >
      {children}
    </div>
  );
}
