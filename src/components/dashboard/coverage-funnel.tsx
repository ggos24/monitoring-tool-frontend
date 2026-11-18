"use client";

import { X } from "lucide-react";
import { AnimatedValue } from "@/components/ui/animated-value";
import { KickerLabel } from "@/components/ui/kicker-label";
import { RefreshLine } from "@/components/ui/refresh-line";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayLabel, formatShareFine, prevRangeLabel, shareChange, type DateWindow } from "@/lib/period";
import type { CampaignAllOutput, ScopeParam } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChangeBadge } from "./kpi-card";
import { useCampaignHeadlines } from "./campaign-data";

/**
 * Share of coverage as a funnel, shown in the chart slot when the Share of
 * coverage card is toggled: every Tier-1 article → the ones about Ukraine →
 * the ones matching the selected queries. GDELT lane on every step: it is
 * the only source that sees all output (backend: app/campaign/output_volume.py).
 * Reuses the KPI row's headline queries, so it costs no extra request.
 */
export function CoverageFunnel({
  scope,
  win,
  country,
  compare,
  onClose,
}: {
  scope: ScopeParam | null;
  win: DateWindow;
  country: string | null;
  compare: boolean;
  onClose: () => void;
}) {
  const { current, previous } = useCampaignHeadlines(scope, win, country, compare);
  const out = current.data?.all_output ?? null;
  const prev = compare ? (previous.data?.all_output ?? null) : null;
  const loading = scope === null || current.isLoading;
  const ready = !!out && out.articles > 0 && out.share != null;
  const change = ready && out.complete && prev?.complete ? shareChange(out.share, prev.share) : undefined;

  return (
    <div className="relative bg-card p-5" data-refreshing={current.isPlaceholderData || undefined}>
      <RefreshLine active={current.isPlaceholderData} />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <KickerLabel>Share of coverage</KickerLabel>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {loading ? (
              <Skeleton className="h-6 w-32" />
            ) : ready ? (
              <>
                <span
                  className="text-[24px] font-medium leading-none text-foreground tabular-nums"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  <AnimatedValue value={formatShareFine(out.share!)} />
                </span>
                <span className="text-xs text-text-secondary">of all Tier-1 articles</span>
                {change && <ChangeBadge change={change} title={prevRangeLabel(win)} />}
                <span className="font-mono text-[11px] text-text-tertiary">· {perThousand(out.share!)}</span>
              </>
            ) : (
              <span className="text-xs text-text-secondary">—</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 border border-border px-2 py-1 font-mono text-[11px] text-text-tertiary transition-colors hover:bg-elevated hover:text-text-secondary"
        >
          <X className="size-3" strokeWidth={1.75} aria-hidden />
          Articles over time
        </button>
      </div>

      {loading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : !ready ? (
        <p className="py-16 text-center font-mono text-xs text-text-tertiary">
          {current.data?.all_output === undefined
            ? "This backend does not count all Tier-1 articles yet."
            : "No Tier-1 article counts for this period yet."}
        </p>
      ) : (
        <Funnel out={out} />
      )}

      {ready && (
        <div className="mt-4 space-y-1 font-mono text-[11px] text-text-tertiary">
          {!out.complete && out.covered_from && (
            <p className="text-warning">
              Counted from {formatDayLabel(out.covered_from)} — earlier days of this period are not in
              the totals.
            </p>
          )}
          <p>{sourcesNote(out)}</p>
        </div>
      )}
    </div>
  );
}

const OUTLET_NAMES: Record<string, string> = {
  "bloomberg.com": "Bloomberg",
  "cnn.com": "CNN",
  "ft.com": "FT",
};

const outletName = (d: string) => OUTLET_NAMES[d] ?? d;

/** Where the totals come from: GDELT, plus outlets counted from their own
 *  sitemaps; outlets whose sitemap count does not cover the period yet. */
function sourcesNote(out: CampaignAllOutput): string {
  const census = Object.keys(out.census_outlets ?? {}).map(outletName);
  const pending = Object.entries(out.census_pending ?? {})
    .filter(([, since]) => since)
    .map(([d, since]) => `${outletName(d)} (counted since ${formatDayLabel(since!)})`);
  const parts = [
    `${out.outlets} Tier-1 media, news only — sport, culture and lifestyle sections are left out on every step. Counted from GDELT${
      census.length ? `, and from their own sitemaps for ${census.join(", ")}` : ""
    } — the sources that list everything an outlet publishes; Google News and RSS bring Ukraine articles only.`,
  ];
  if (pending.length) {
    parts.push(
      `Not in this period yet: ${pending.join(", ")} — they join once their count covers it and the previous period.`,
    );
  }
  parts.push("An article GDELT repeats later counts again (≈5%). Bar heights on a log scale.");
  return parts.join(" ");
}

function perThousand(share: number): string {
  const n = share * 1000;
  return `≈ ${n < 10 ? n.toFixed(1).replace(/\.0$/, "") : Math.round(n)} of every 1,000`;
}

type Step = {
  label: string;
  value: number;
  note: string;
  drop?: number;
  tone: "base" | "mid" | "end";
};

function Funnel({ out }: { out: CampaignAllOutput }) {
  const ukraine = out.about_ukraine ?? 0;
  const steps: Step[] = [
    {
      label: "All articles",
      value: out.articles,
      note: "funnel base",
      drop: out.articles ? 1 - ukraine / out.articles : undefined,
      tone: "base",
    },
    {
      label: "About Ukraine",
      value: ukraine,
      note: out.ukraine_share != null ? `${formatShareFine(out.ukraine_share)} of all` : "—",
      drop: ukraine ? 1 - out.matched / ukraine : undefined,
      tone: "mid",
    },
    {
      label: "Our queries",
      value: out.matched,
      note: `${formatShareFine(out.share ?? 0)} of all${
        ukraine ? ` · ${formatShareFine(out.matched / ukraine)} of Ukraine` : ""
      }`,
      tone: "end",
    },
  ];
  // Log scale: 12,000 → 600 → 30 stays readable; a linear bar for the last
  // step would be under a pixel.
  const top = Math.log10(out.articles + 1);
  const height = (n: number) => Math.max(4, (Math.log10(n + 1) / top) * 100);
  const heights = steps.map((s) => height(s.value));

  return (
    <div>
      <div className="grid grid-cols-3 border-t border-border pt-4">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className={cn("min-w-0 px-4 first:pl-0 last:pr-0", i < steps.length - 1 && "border-r border-border")}
          >
            <KickerLabel className={s.tone === "end" ? "text-success" : undefined}>{s.label}</KickerLabel>
            <div
              className="mt-2.5 text-[18px] font-medium leading-none text-foreground tabular-nums sm:text-[24px]"
              style={{ letterSpacing: "-0.02em" }}
            >
              <AnimatedValue value={`${s.tone === "base" ? "≈" : ""}${s.value.toLocaleString()}`} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-text-tertiary">
              <span className="truncate">{s.note}</span>
              {s.drop != null && (
                <span
                  className="border border-border px-1.5 py-px tabular-nums"
                  title="Dropped before the next step"
                >
                  ↘ {Math.round(s.drop * 100)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex h-[150px] items-end" aria-hidden>
        {steps.map((s, i) => (
          <div key={s.label} className="flex h-full flex-1 items-end">
            <div
              className={cn(
                "h-full flex-[3]",
                s.tone === "end" ? "bg-success" : "bg-text-secondary",
                s.tone === "mid" && "opacity-70",
              )}
              style={{ height: `${heights[i]}%` }}
            />
            {i < steps.length - 1 ? (
              <div
                className="h-full flex-[1.3] bg-text-secondary opacity-25"
                style={{
                  clipPath: `polygon(0 ${100 - heights[i]}%, 100% ${100 - heights[i + 1]}%, 100% 100%, 0 100%)`,
                }}
              />
            ) : (
              <div className="flex-[1.3]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
