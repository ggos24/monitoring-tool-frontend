"use client";

import { FAVORABILITY_TOOLTIP, favorabilityReadiness } from "@/lib/favorability";
import { countChange, formatDayLabel, formatShare, prevRangeLabel, shareChange, type DateWindow } from "@/lib/period";
import type { CampaignFavorability, CampaignHeadline, ScopeParam } from "@/lib/types";
import { countryName, iso2ToFlagEmoji } from "@/lib/country";
import { KickerLabel } from "@/components/ui/kicker-label";
import { KpiCard } from "./kpi-card";
import { CountDelta } from "./top-geo-card";
import {
  comparableTotals,
  excludedLanes,
  excludedLanesText,
  isNotFound,
  laneLabel,
  shownTotals,
  useCampaignHeadlines,
} from "./campaign-data";

/**
 * Headline KPIs from /api/campaign/headline. The VALUES count every source
 * (GDELT, Google News, RSS, …), each article once. The CHANGE vs the
 * previous period is like-for-like: only the sources that already covered
 * the previous window, so a newly added source doesn't read as growth; a
 * line under the cards names the sources left out. One call per window.
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
  const { coverage, coverageSettled, current, previous } = useCampaignHeadlines(
    scope,
    win,
    country,
    compare,
  );

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

  // Shown: all sources. Compared: the like-for-like subset of both windows.
  const h = shownTotals(cur);
  const ph = shownTotals(prev);
  const c = comparableTotals(cur);
  const pc = comparableTotals(prev);
  const comparable = !!prev && !!c && !!pc;
  const excluded = prev ? excludedLanes(cur) : [];
  const lanes = (cur?.all_sources?.by_source ?? []).filter((l) => l.articles > 0);
  const changeTitle = win.prevLabel;
  const partial =
    ingest.kind === "partial"
      ? ` Collected through ${formatDayLabel(ingest.through)} so far — the figure can still grow.`
      : "";

  const fav = favorableShare(h?.favorability);
  const favPrev = favorableShare(ph?.favorability);
  const favCmp = favorableShare(c?.favorability);
  const favCmpPrev = favorableShare(pc?.favorability);
  const countries = h?.countries;
  // Previous-period row: absent when not comparing, "—" when the value is missing.
  const prevValue = (v: string | undefined) => (!compare ? undefined : previous.isLoading ? "…" : prev ? (v ?? null) : null);
  // Size of the Tier-1 network the outlets are counted out of.
  const cov = coverage.data;
  const network = cov?.available
    ? (cov.counts.visible ?? 0) + (cov.counts.sparse ?? 0) + (cov.counts.invisible ?? 0)
    : null;
  const changeNote = excluded.length
    ? `${changeTitle}, without ${excludedLanesText(excluded)}`
    : changeTitle;

  return (
    // 2 columns until xl, then one row; Top countries takes a full row on
    // narrow screens so the grid never ends with an empty cell.
    <>
    <div className={`grid grid-cols-2 gap-px border border-border bg-border ${countries ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
      <KpiCard
        kicker="Articles"
        title={"Articles from our Tier-1 media in the selected narratives. Each article is counted once." + partial}
        value={(h?.articles ?? 0).toLocaleString()}
        context={
          lanes.length > 1
            ? lanes.map((l) => `${l.articles.toLocaleString()} ${laneLabel(l.code)}`).join(" · ")
            : "in Tier-1 media"
        }
        previous={prevValue(ph?.articles.toLocaleString())}
        previousLabel={win.prevLabel}
        previousTitle={prevRangeLabel(win)}
        change={comparable ? countChange(c?.articles, pc?.articles) : undefined}
        changeTitle={changeNote}
        isLoading={loading}
      />
      <KpiCard
        kicker="Share of coverage"
        title={SHARE_TOOLTIP}
        value={h?.pool_share == null ? "—" : formatShare(h.pool_share)}
        context={
          h?.pool_articles == null
            ? undefined
            : `${(h.articles ?? 0).toLocaleString()} of ${h.pool_articles.toLocaleString()} Ukraine–Russia articles`
        }
        previous={prevValue(ph?.pool_share == null ? undefined : formatShare(ph.pool_share))}
        previousLabel={win.prevLabel}
        previousTitle={prevRangeLabel(win)}
        change={comparable ? shareChange(c?.pool_share, pc?.pool_share) : undefined}
        changeTitle={changeNote}
        isLoading={loading}
      />
      <KpiCard
        kicker="Favorable to Ukraine"
        title={FAVORABILITY_TOOLTIP}
        value={fav.value === null ? "—" : formatShare(fav.value)}
        context={fav.note}
        previous={prevValue(favPrev.value === null ? undefined : formatShare(favPrev.value))}
        previousLabel={win.prevLabel}
        previousTitle={prevRangeLabel(win)}
        change={comparable ? shareChange(favCmp.value, favCmpPrev.value) : undefined}
        changeTitle={changeNote}
        isLoading={loading}
      />
      <KpiCard
        kicker="Media reached"
        title="How many different Tier-1 media published at least one of these articles."
        value={(h?.outlets ?? 0).toLocaleString()}
        context={network === null ? "with at least one article" : `of ${network} Tier-1 media`}
        previous={prevValue(ph?.outlets.toLocaleString())}
        previousLabel={win.prevLabel}
        previousTitle={prevRangeLabel(win)}
        change={comparable ? countChange(c?.outlets, pc?.outlets) : undefined}
        changeTitle={changeNote}
        isLoading={loading}
      />
      {countries && (
        <CountriesCard
          rows={countries}
          current={comparable ? c?.countries : undefined}
          previous={comparable ? pc?.countries : undefined}
          win={win}
        />
      )}
    </div>
    {excluded.length > 0 && comparable && (
      <div className="border border-t-0 border-border bg-card px-5 py-2 font-mono text-[11px] text-text-tertiary">
        Change vs {win.prevLabel.toLowerCase()} counts only sources collected in both periods —
        not {excludedLanesText(excluded)}.
      </div>
    )}
    </>
  );
}

const SHARE_TOOLTIP =
  "Of all articles our Tier-1 media published about Ukraine or Russia in this period, " +
  "the share that matches this query. An article counts as about Ukraine/Russia when its " +
  "headline names Ukraine, Russia, Kyiv, the Kremlin, Putin or Zelensky, or it covers " +
  "Russia together with weapons, sanctions or military cooperation.";

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
    return (shownTotals(cur)?.articles ?? 0) === 0 ? { kind: "none", through } : { kind: "ok" };
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
  if (scored === 0 || !favorabilityReadiness(f, f).ready) {
    return { value: null, note: "Not enough analysed yet" };
  }
  return { value: f.favorable / scored, note: `of ${scored.toLocaleString()} analysed` };
}

function CountriesCard({
  rows,
  current,
  previous,
  win,
}: {
  /** Shown counts (all sources). */
  rows: { iso2: string | null; count: number }[];
  /** Like-for-like counts of this window and the previous one — the change
   *  is computed between these two, not from `rows`. */
  current: { iso2: string | null; count: number }[] | undefined;
  previous: { iso2: string | null; count: number }[] | undefined;
  win: DateWindow;
}) {
  const total = rows.reduce((sum, c) => sum + c.count, 0);
  const prevByIso = new Map((previous ?? []).map((c) => [c.iso2, c.count] as const));
  const curByIso = new Map((current ?? []).map((c) => [c.iso2, c.count] as const));
  // 4 rows = exactly the height of the KPI cards next to it; a 5th makes the row taller.
  const top = rows.filter((c) => c.iso2).slice(0, 4);
  return (
    <div className="col-span-2 bg-card p-5 xl:col-span-1">
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
              {previous && current ? (
                <CountDelta
                  current={curByIso.get(c.iso2) ?? 0}
                  previous={prevByIso.get(c.iso2) ?? 0}
                  title={win.prevLabel}
                />
              ) : (
                <span className="w-9 text-right font-mono text-[11px] tabular-nums text-text-tertiary">
                  {total > 0 ? Math.round((c.count / total) * 100) : 0}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      
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
