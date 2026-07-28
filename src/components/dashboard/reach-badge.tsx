"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tooltip } from "@base-ui/react/tooltip";

import { ApiError, apiClient } from "@/lib/api";
import {
  ScoringPopoverError,
  ScoringPopoverLoading,
  formatScoringDate,
} from "@/components/dashboard/domain-score-badge";
import type { DomainScoringDetail, ReachBand } from "@/lib/types";
import { cn } from "@/lib/utils";

// Reach is a DIFFERENT axis from trust — how loud a source is, not how
// trustworthy. So the ramp is deliberately a monochrome blue "intensity"
// scale (dim → bright), NOT the red→green trust semantics. A high-reach
// propaganda outlet must never look green/"good"; it's just loud.
const REACH_STYLES: Record<number, { bg: string; fg: string }> = {
  0: { bg: "bg-strong", fg: "text-text-tertiary" },
  1: { bg: "bg-sky-950", fg: "text-sky-300" },
  2: { bg: "bg-sky-900", fg: "text-sky-200" },
  3: { bg: "bg-sky-800", fg: "text-sky-100" },
  4: { bg: "bg-sky-700", fg: "text-sky-50" },
  5: { bg: "bg-sky-600", fg: "text-sky-50" },
};

const BAND_LABEL: Record<ReachBand, string> = {
  high: "High reach",
  mid: "Mid reach",
  low: "Low reach",
};

/**
 * Audience/authority badge (Decision 32), 0-5 tier parallel to the trust
 * DomainScoreBadge. `tier` is the display bucket; `score` (0-100) and
 * `band` enrich the tooltip. When `tier` is null the domain has no reach
 * signal yet (DataForSEO + Tranco both missing) → dim "—".
 *
 * Pass `domain` to get the rich hover popover explaining how the number
 * is assembled (authority/traffic split + the raw reach signals). It
 * reads the same `["domain-scoring", domain]` query the trust badge
 * uses, so hovering both badges costs a single request.
 */
export function ReachBadge({
  tier,
  score,
  band,
  domain,
  className,
}: {
  tier?: number | null;
  score?: number | null;
  band?: ReachBand | null;
  domain?: string;
  className?: string;
}) {
  const badgeClasses = cn(
    "inline-flex size-[18px] items-center justify-center font-mono text-[10px] leading-none tabular-nums",
    className,
  );

  if (tier === null || tier === undefined) {
    return (
      <span
        title="Reach: not resolved yet"
        aria-label="Reach: not resolved yet"
        className={cn(badgeClasses, "bg-strong text-muted-foreground")}
      >
        —
      </span>
    );
  }

  const clamped = Number.isInteger(tier) && tier >= 0 && tier <= 5 ? tier : 0;
  const { bg, fg } = REACH_STYLES[clamped];
  const bandText = band ? ` · ${BAND_LABEL[band]}` : "";
  const scoreText = typeof score === "number" ? ` · ${score}/100` : "";
  const titleText = `Reach: ${clamped}/5${bandText}${scoreText}`;
  const classes = cn(badgeClasses, bg, fg);

  if (!domain) {
    return (
      <span title={titleText} aria-label={titleText} className={classes}>
        {clamped}
      </span>
    );
  }

  return (
    <ReachBadgeWithPopover
      domain={domain}
      clamped={clamped}
      band={band ?? null}
      score={score ?? null}
      titleText={titleText}
      badgeClasses={classes}
    />
  );
}

function ReachBadgeWithPopover({
  domain,
  clamped,
  band,
  score,
  titleText,
  badgeClasses,
}: {
  domain: string;
  clamped: number;
  band: ReachBand | null;
  score: number | null;
  titleText: string;
  badgeClasses: string;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["domain-scoring", domain],
    queryFn: () => apiClient.domainScoring(domain),
    enabled: open,
    staleTime: Infinity,
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 404) return false;
      return count < 1;
    },
  });

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger
        delay={200}
        closeDelay={100}
        render={
          <span
            title={titleText}
            aria-label={titleText}
            className={badgeClasses}
          >
            {clamped}
          </span>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner
          className="z-[100]"
          sideOffset={6}
          align="start"
          side="top"
        >
          <Tooltip.Popup
            className={cn(
              "z-[100] w-72 border border-border bg-overlay p-4 text-text-secondary outline-none",
              "duration-100 data-[instant]:duration-0",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            )}
          >
            <ReachPopoverHeader
              domain={domain}
              tier={clamped}
              band={band}
              score={score}
            />
            {isLoading ? (
              <ScoringPopoverLoading />
            ) : error ? (
              <ScoringPopoverError error={error} onRetry={refetch} />
            ) : data ? (
              <ReachPopoverBody data={data} />
            ) : null}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function ReachPopoverHeader({
  domain,
  tier,
  band,
  score,
}: {
  domain: string;
  tier: number;
  band: ReachBand | null;
  score: number | null;
}) {
  const { bg, fg } = REACH_STYLES[tier];
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex size-[18px] shrink-0 items-center justify-center font-mono text-[10px] leading-none tabular-nums",
          bg,
          fg,
        )}
      >
        {tier}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] text-foreground">{domain}</div>
        <div className="font-mono text-[11px] text-text-tertiary">
          {band ? BAND_LABEL[band] : "Reach"}
          {typeof score === "number" ? ` · ${score}/100` : ""}
        </div>
      </div>
    </div>
  );
}

function ReachPopoverBody({ data }: { data: DomainScoringDetail }) {
  const signals = Object.fromEntries(
    data.signals.map((s) => [s.provider, s]),
  );
  const ilr = signals["dataforseo_ilr"]?.raw_value?.["rank"];
  const etv = signals["dataforseo_etv"]?.raw_value?.["etv"];
  const trancoRank = signals["tranco"]?.raw_value?.["rank"];

  return (
    <>
      <div className="mt-3 border-t border-border pt-3 text-[12px] leading-snug text-text-secondary">
        Reach blends backlink authority with audience-size estimates
        (50/50; a missing side is not penalized). It measures how loud a
        source is — never how trustworthy.
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 font-mono text-[9px] uppercase leading-none tracking-[0.12em] text-muted-foreground">
          Formula
        </div>
        <ul className="space-y-1.5 font-mono text-[11px]">
          <li className="flex items-baseline justify-between">
            <span className="text-text-tertiary">Authority</span>
            <span className="text-foreground tabular-nums">
              {typeof data.reach_authority === "number"
                ? `${Math.round(data.reach_authority * 100)}%`
                : "—"}
            </span>
          </li>
          <li className="flex items-baseline justify-between">
            <span className="text-text-tertiary">Traffic</span>
            <span className="text-foreground tabular-nums">
              {typeof data.reach_traffic === "number"
                ? `${Math.round(data.reach_traffic * 100)}%`
                : "—"}
            </span>
          </li>
        </ul>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 font-mono text-[9px] uppercase leading-none tracking-[0.12em] text-muted-foreground">
          Signals
        </div>
        <ul className="space-y-1.5 font-mono text-[11px]">
          <ReachSignalRow
            label="InLink Rank"
            value={
              typeof ilr === "number" ? `${ilr}/1000 backlink authority` : null
            }
          />
          <ReachSignalRow
            label="Est. traffic"
            value={
              typeof etv === "number"
                ? `~${Math.round(etv).toLocaleString()} organic visits/mo`
                : null
            }
          />
          <ReachSignalRow
            label="Tranco"
            value={
              typeof trancoRank === "number"
                ? `global rank ${trancoRank.toLocaleString()}`
                : null
            }
          />
        </ul>
      </div>

      <div className="mt-3 border-t border-border pt-3 font-mono text-[10px] text-text-tertiary tabular-nums">
        Refreshed {formatScoringDate(data.refreshed_at)}
      </div>
    </>
  );
}

function ReachSignalRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <li className="grid grid-cols-[80px_1fr] gap-2">
      <span
        className={cn(
          "font-mono text-[11px]",
          value ? "text-text-tertiary" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[11px]",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {value ?? "—"}
      </span>
    </li>
  );
}
