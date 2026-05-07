"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tooltip } from "@base-ui/react/tooltip";

import { ApiError, apiClient } from "@/lib/api";
import type { DomainScoringDetail, DomainScoringSignal } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Style = { bg: string; fg: string; label: string };

const STYLES: Record<number, Style> = {
  0: { bg: "bg-red-700", fg: "text-red-50", label: "Propaganda" },
  1: { bg: "bg-orange-700", fg: "text-orange-50", label: "Low quality" },
  2: { bg: "bg-zinc-800", fg: "text-zinc-400", label: "Unknown" },
  3: { bg: "bg-lime-700", fg: "text-lime-50", label: "Trusted (low)" },
  4: { bg: "bg-green-700", fg: "text-green-50", label: "Trusted (mid)" },
  5: { bg: "bg-emerald-600", fg: "text-emerald-50", label: "Trusted (top)" },
};

const REASON_TEXT: Record<string, string> = {
  propaganda_hardlist_viginum:
    "Listed by VIGINUM Portal Kombat as a propaganda domain.",
  propaganda_euvsdisinfo: "High disinformation frequency on EUvsDisinfo.",
  low_disinfo_euvsdisinfo: "Some disinformation references on EUvsDisinfo.",
  trusted_top_euvsdisinfo:
    "Frequently cited as trustworthy on EUvsDisinfo (≥20 references).",
  trusted_mid_euvsdisinfo:
    "Cited as trustworthy on EUvsDisinfo (5–19 references).",
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
  euvsdisinfo: "EUvsDisinfo",
  tranco: "Tranco",
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
  const { bg, fg, label } = STYLES[clamped];
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
        <Tooltip.Positioner sideOffset={6} align="start" side="top">
          <Tooltip.Popup
            className={cn(
              "z-50 w-72 border border-zinc-800 bg-zinc-950 p-4 text-zinc-300 outline-none",
              "duration-100 data-[instant]:duration-0",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            )}
          >
            <PopoverHeader domain={domain} score={data?.score ?? clamped} />
            {isLoading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState error={error} onRetry={refetch} />
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
  const { bg, fg, label } = STYLES[clamped];
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
        <div className="truncate text-[13px] text-zinc-50">{domain}</div>
        <div className="font-mono text-[11px] text-zinc-400">{label}</div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-3 space-y-2">
      <Skeleton className="h-3 w-3/4 bg-zinc-900" />
      <Skeleton className="h-3 w-1/2 bg-zinc-900" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-full bg-zinc-900" />
        <Skeleton className="h-3 w-full bg-zinc-900" />
        <Skeleton className="h-3 w-full bg-zinc-900" />
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="mt-3 font-mono text-[11px] text-zinc-500">
        No scoring data yet.
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-3 font-mono text-[11px] text-zinc-400">
      <span>Failed to load detail</span>
      <button
        type="button"
        onClick={() => onRetry()}
        className="border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-300 hover:border-zinc-700 hover:text-zinc-50"
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
      <div className="mt-3 border-t border-zinc-800 pt-3 text-[12px] leading-snug text-zinc-200">
        {reasonSentence}
      </div>

      <div className="mt-3 border-t border-zinc-800 pt-3">
        <div className="mb-2 font-mono text-[9px] uppercase leading-none tracking-[0.12em] text-zinc-500">
          Signals
        </div>
        <ul className="space-y-1.5">
          {data.signals.map((signal) => (
            <SignalRow key={signal.provider} signal={signal} />
          ))}
        </ul>
      </div>

      <div className="mt-3 border-t border-zinc-800 pt-3 font-mono text-[10px] text-zinc-600 tabular-nums">
        Refreshed {formatDate(data.refreshed_at)}
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
          hasSignal ? "text-zinc-400" : "text-zinc-600",
        )}
      >
        {providerLabel}
      </span>
      {hasSignal ? (
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-zinc-100">
            {signal.flag}
          </div>
          {signal.raw_value && (
            <div className="font-mono text-[10px] text-zinc-500">
              {formatRawValue(signal)}
            </div>
          )}
        </div>
      ) : (
        <span className="font-mono text-[11px] text-zinc-600">—</span>
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
  if (signal.provider === "euvsdisinfo") {
    const trusted = signal.raw_value["trusted_freq"];
    const disinfo = signal.raw_value["disinfo_freq"];
    const parts: string[] = [];
    if (typeof trusted === "number") parts.push(`${trusted} trusted refs`);
    if (typeof disinfo === "number") parts.push(`${disinfo} disinfo refs`);
    return parts.join(" · ");
  }
  return "";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}
