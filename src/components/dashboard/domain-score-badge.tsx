"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tooltip } from "@base-ui/react/tooltip";

import { ApiError, apiClient } from "@/lib/api";
import type { DomainScoringDetail, DomainScoringSignal } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Style = { bg: string; fg: string; label: string };

// Exported for the TrustReachComboBadge prototype (colour = trust band).
export const TRUST_STYLES: Record<number, Style> = {
  0: { bg: "bg-red-700", fg: "text-red-50", label: "Propaganda" },
  1: { bg: "bg-orange-700", fg: "text-orange-50", label: "Low quality" },
  // Unknown sits on the elevated surface — bumped from bg-strong/text-text-tertiary
  // (~3.2:1) to bg-strong/text-foreground (~10:1) so it reads as a real badge.
  2: { bg: "bg-strong", fg: "text-foreground", label: "Unknown" },
  3: { bg: "bg-lime-700", fg: "text-lime-50", label: "Trusted (low)" },
  4: { bg: "bg-green-700", fg: "text-green-50", label: "Trusted (mid)" },
  5: { bg: "bg-emerald-600", fg: "text-emerald-50", label: "Trusted (top)" },
};

const REASON_TEXT: Record<string, string> = {
  // v6 evidence model (Decision 34)
  propaganda_sanctions_nazk:
    "Media entity sanctioned by Ukraine's NSDC (NAZK registry).",
  trusted_corroborated:
    "Confirmed trustworthy by two or more independent sources.",
  trusted_established: "Confirmed trustworthy by an authoritative source.",
  trusted_emerging: "Positive quality signal from one source.",
  trusted_emerging_high_reach:
    "Positive quality signal and high real-world reach.",
  contested_signals:
    "Independent sources disagree about this domain — treat with care.",
  low_quality_mbfc: "Rated low factual reporting by MBFC (idiap dataset).",
  low_quality_rsp:
    "Rated generally unreliable or deprecated by Wikipedia's perennial-sources consensus.",
  propaganda_hardlist_viginum:
    "Listed by VIGINUM Portal Kombat as a propaganda domain.",
  propaganda_euvsdisinfo: "High disinformation frequency on EUvsDisinfo.",
  low_disinfo_euvsdisinfo: "Some disinformation references on EUvsDisinfo.",
  // Legacy v4/v5 reasons — kept so historical scoring_entity rows still explain.
  trusted_top_euvsdisinfo:
    "Frequently cited as trustworthy on EUvsDisinfo (≥20 references).",
  trusted_mid_euvsdisinfo:
    "Cited as trustworthy on EUvsDisinfo (5–19 references).",
  trusted_low_high_reach:
    "Trustworthy on EUvsDisinfo and high real-world reach.",
  // Legacy v3 reasons — kept so historical scoring_entity rows still explain.
  trusted_low_popular: "Trustworthy on EUvsDisinfo and high-traffic on Tranco.",
  trusted_low_euvsdisinfo:
    "Cited as trustworthy on EUvsDisinfo (1–4 references).",
  tranco_top10k: "High traffic — Tranco top 10k.",
  tranco_top100k: "Moderate traffic — Tranco top 100k.",
  tranco_long_tail: "Low traffic — outside Tranco top 100k.",
  unknown: "Not enough information to rate this domain.",
};

const PROVIDER_LABEL: Record<DomainScoringSignal["provider"], string> = {
  viginum: "VIGINUM",
  nazk: "NSDC sanctions",
  euvsdisinfo: "EUvsDisinfo",
  mbfc: "MBFC (idiap)",
  iffy: "Iffy index",
  imi_whitelist: "IMI white list",
  ifcn: "IFCN",
  wikipedia_rsp: "Wikipedia RSP",
  tranco: "Tranco",
  dataforseo_ilr: "InLink Rank",
  dataforseo_etv: "Est. traffic",
};

export function DomainScoreBadge({
  score,
  isPropaganda,
  domain,
  className,
}: {
  score: number;
  isPropaganda?: boolean;
  domain?: string;
  className?: string;
}) {
  const clamped = Number.isInteger(score) && score >= 0 && score <= 5 ? score : 2;
  const { bg, fg, label } = TRUST_STYLES[clamped];
  const titleText =
    isPropaganda && clamped !== 0
      ? `Quality: ${clamped}/5 · ${label} · propaganda`
      : `Quality: ${clamped}/5 · ${label}`;

  const badgeClasses = cn(
    "inline-flex size-[18px] items-center justify-center font-mono text-[10px] leading-none tabular-nums",
    bg,
    fg,
    className,
  );

  if (!domain) {
    return (
      <span title={titleText} className={badgeClasses}>
        {clamped}
      </span>
    );
  }

  return (
    <BadgeWithTooltip
      domain={domain}
      clamped={clamped}
      titleText={titleText}
      badgeClasses={badgeClasses}
    />
  );
}

function BadgeWithTooltip({
  domain,
  clamped,
  titleText,
  badgeClasses,
}: {
  domain: string;
  clamped: number;
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
        <Tooltip.Positioner className="z-[100]" sideOffset={6} align="start" side="top">
          <Tooltip.Popup
            className={cn(
              "z-50 w-72 border border-border bg-overlay p-4 text-text-secondary outline-none",
              "duration-100 data-[instant]:duration-0",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            )}
          >
            <PopoverHeader domain={domain} score={data?.score ?? clamped} />
            {isLoading ? (
              <ScoringPopoverLoading />
            ) : error ? (
              <ScoringPopoverError error={error} onRetry={refetch} />
            ) : data ? (
              <PopoverBody data={data} />
            ) : null}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function PopoverHeader({
  domain,
  score,
}: {
  domain: string;
  score: number;
}) {
  const clamped = Number.isInteger(score) && score >= 0 && score <= 5 ? score : 2;
  const { bg, fg, label } = TRUST_STYLES[clamped];
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex size-[18px] shrink-0 items-center justify-center font-mono text-[10px] leading-none tabular-nums",
          bg,
          fg,
        )}
      >
        {clamped}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] text-foreground">{domain}</div>
        <div className="font-mono text-[11px] text-text-tertiary">{label}</div>
      </div>
    </div>
  );
}

export function ScoringPopoverLoading() {
  return (
    <div className="mt-3 space-y-2">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export function ScoringPopoverError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="mt-3 font-mono text-[11px] text-text-tertiary">
        No scoring data yet.
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-3 font-mono text-[11px] text-text-secondary">
      <span>Failed to load detail</span>
      <button
        type="button"
        onClick={() => onRetry()}
        className="border border-border bg-elevated px-2 py-0.5 text-text-secondary hover:border-strong hover:text-foreground"
      >
        retry
      </button>
    </div>
  );
}

function PopoverBody({ data }: { data: DomainScoringDetail }) {
  const reasonSentence = REASON_TEXT[data.reason] ?? REASON_TEXT.unknown;

  return (
    <>
      <div className="mt-3 border-t border-border pt-3 text-[12px] leading-snug text-text-secondary">
        {reasonSentence}
      </div>

      {typeof data.reach_score === "number" && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 font-mono text-[9px] uppercase leading-none tracking-[0.12em] text-muted-foreground">
            Reach
          </div>
          <div className="flex items-baseline justify-between font-mono text-[11px]">
            <span className="text-foreground">
              {data.reach_tier ?? "—"}/5
              {data.reach_band ? ` · ${data.reach_band}` : ""}
            </span>
            <span className="text-text-tertiary tabular-nums">
              {data.reach_score}/100
            </span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-text-tertiary tabular-nums">
            {formatReachComponents(data)}
          </div>
        </div>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 font-mono text-[9px] uppercase leading-none tracking-[0.12em] text-muted-foreground">
          Signals
        </div>
        <ul className="space-y-1.5">
          {data.signals.map((signal) => (
            <SignalRow key={signal.provider} signal={signal} />
          ))}
        </ul>
      </div>

      <div className="mt-3 border-t border-border pt-3 font-mono text-[10px] text-text-tertiary tabular-nums">
        Refreshed {formatScoringDate(data.refreshed_at)}
      </div>
    </>
  );
}

function SignalRow({ signal }: { signal: DomainScoringSignal }) {
  const providerLabel = PROVIDER_LABEL[signal.provider];
  const hasSignal = signal.flag !== null;
  return (
    <li className="grid grid-cols-[80px_1fr] gap-2">
      <span
        className={cn(
          "font-mono text-[11px]",
          hasSignal ? "text-text-tertiary" : "text-muted-foreground",
        )}
      >
        {providerLabel}
      </span>
      {hasSignal ? (
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-foreground">
            {signal.flag}
          </div>
          {signal.raw_value && (
            <div className="font-mono text-[10px] text-text-tertiary">
              {formatRawValue(signal)}
            </div>
          )}
        </div>
      ) : (
        <span className="font-mono text-[11px] text-muted-foreground">—</span>
      )}
    </li>
  );
}

function formatRawValue(signal: DomainScoringSignal): string {
  if (!signal.raw_value) return "";
  if (signal.provider === "tranco") {
    const rank = signal.raw_value["rank"];
    return typeof rank === "number" ? `Rank ${rank.toLocaleString()}` : "";
  }
  if (signal.provider === "dataforseo_ilr") {
    const rank = signal.raw_value["rank"];
    return typeof rank === "number" ? `${rank}/1000` : "";
  }
  if (signal.provider === "dataforseo_etv") {
    const etv = signal.raw_value["etv"];
    return typeof etv === "number"
      ? `~${Math.round(etv).toLocaleString()} organic/mo`
      : "";
  }
  if (signal.provider === "euvsdisinfo") {
    const trusted = signal.raw_value["trusted_freq"];
    const disinfo = signal.raw_value["disinfo_freq"];
    const parts: string[] = [];
    if (typeof trusted === "number") parts.push(`${trusted} trusted refs`);
    if (typeof disinfo === "number") parts.push(`${disinfo} disinfo refs`);
    return parts.join(" · ");
  }
  if (signal.provider === "mbfc") {
    const factual = signal.raw_value["factual_reporting"];
    const bias = signal.raw_value["bias"];
    const parts: string[] = [];
    if (typeof factual === "string") parts.push(`factual: ${factual}`);
    if (typeof bias === "string" && bias) parts.push(`bias: ${bias}`);
    return parts.join(" · ");
  }
  if (signal.provider === "iffy") {
    const cred = signal.raw_value["mbfc_cred"];
    return typeof cred === "string" && cred ? `credibility: ${cred}` : "";
  }
  if (signal.provider === "imi_whitelist" || signal.provider === "nazk") {
    const annotation = signal.raw_value["annotation"];
    return typeof annotation === "string" ? annotation : "";
  }
  return "";
}

function formatReachComponents(data: DomainScoringDetail): string {
  const parts: string[] = [];
  if (typeof data.reach_authority === "number") {
    parts.push(`authority ${Math.round(data.reach_authority * 100)}%`);
  }
  if (typeof data.reach_traffic === "number") {
    parts.push(`traffic ${Math.round(data.reach_traffic * 100)}%`);
  }
  return parts.join(" · ");
}

export function formatScoringDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}
