"use client";

import { useQuery } from "@tanstack/react-query";
import { Tooltip } from "@base-ui/react/tooltip";

import { apiClient } from "@/lib/api";
import { DomainScoreBadge } from "@/components/dashboard/domain-score-badge";
import { ReachBadge } from "@/components/dashboard/reach-badge";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import { countryName, formatConfidence, iso2ToFlagEmoji } from "@/lib/country";
import { dayRange, formatDayLabel } from "@/lib/period";
import type { CountryConfidence, ReachBand, ScopeParam } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SourcesList({
  scope,
  days,
  country,
  selectedDay,
  source,
  quality,
  selectedDomain,
  onToggleDomain,
}: {
  scope: ScopeParam | null;
  days: number;
  country: string | null;
  selectedDay: string | null;
  source: "all" | "gn" | "gdelt" | "firehose" | "rss";
  quality: "all" | "trusted" | "suspect" | "propaganda";
  selectedDomain: string | null;
  onToggleDomain: (domain: string) => void;
}) {
  const enabled = scope !== null;
  const LIMIT = 25;
  const range = selectedDay ? dayRange(selectedDay) : null;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sources",
      scope,
      days,
      country,
      source,
      quality,
      LIMIT,
      range?.from ?? null,
      range?.to ?? null,
    ],
    queryFn: () =>
      apiClient.topSources(scope!, days, LIMIT, country, {
        source: source === "all" ? undefined : source,
        score_band: quality === "all" ? undefined : quality,
        date_from: range?.from,
        date_to: range?.to,
      }),
    enabled,
  });

  return (
    <div className="flex h-full flex-col bg-card p-5">
      <KickerLabel>Top sources</KickerLabel>
      <div className="mt-1 mb-4 text-xs text-text-tertiary">
        Top {LIMIT} domains by mention count,{" "}
        {selectedDay ? formatDayLabel(selectedDay) : `last ${days}d`}
      </div>

      {!enabled || isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full bg-elevated" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 font-mono text-[11px] text-text-tertiary">
          <span>Failed to load sources</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="border border-border bg-elevated px-2 py-0.5 text-text-secondary hover:border-strong hover:text-foreground"
          >
            retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyMessage>No sources in selected period.</EmptyMessage>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 bg-card">
              <ColumnHeader />
            </div>
            <ul className="-mx-2">
              {data.map((s) => (
                <SourceRow
                  key={s.domain}
                  domain={s.domain}
                  count={s.count}
                  score={s.score}
                  isPropaganda={s.is_propaganda}
                  reachTier={s.reach_tier ?? null}
                  reachScore={s.reach_score ?? null}
                  reachBand={s.reach_band ?? null}
                  countryIso2={s.country_iso2 ?? null}
                  countryConfidence={s.country_confidence ?? null}
                  isActive={s.domain === selectedDomain}
                  onToggle={onToggleDomain}
                />
              ))}
            </ul>
          </div>
          <div className="mt-3 shrink-0 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground tabular-nums">
            {data.length} {data.length === 1 ? "domain" : "domains"}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceRow({
  domain,
  count,
  score,
  isPropaganda,
  reachTier,
  reachScore,
  reachBand,
  countryIso2,
  countryConfidence,
  isActive,
  onToggle,
}: {
  domain: string;
  count: number;
  score: number;
  isPropaganda: boolean;
  reachTier: number | null;
  reachScore: number | null;
  reachBand: ReachBand | null;
  countryIso2: string | null;
  countryConfidence: CountryConfidence | null;
  isActive: boolean;
  onToggle: (domain: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(domain)}
        aria-pressed={isActive}
        title={
          isActive
            ? `Clear filter for ${domain}`
            : `Filter mentions to ${domain}`
        }
        className={cn(
          "block w-full cursor-pointer px-2 py-1.5 text-left transition-colors",
          isActive ? "bg-elevated" : "hover:bg-elevated/60",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "flex min-w-0 items-center gap-2 font-mono text-xs",
              isActive ? "text-foreground" : "text-text-secondary",
            )}
          >
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
              alt=""
              width={16}
              height={16}
              loading="lazy"
              className="size-4 shrink-0"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
            <CountryFlag iso2={countryIso2} confidence={countryConfidence} />
            <span className="truncate">{domain}</span>
          </span>
          <span className="flex shrink-0 items-center gap-4">
            <span className="w-8 text-right font-mono text-xs font-medium text-foreground tabular-nums">
              {count}
            </span>
            <span className="flex w-[18px] justify-center">
              <DomainScoreBadge
                score={score}
                isPropaganda={isPropaganda}
                domain={domain}
              />
            </span>
            <span className="flex w-[18px] justify-center">
              <ReachBadge
                tier={reachTier}
                score={reachScore}
                band={reachBand}
              />
            </span>
          </span>
        </div>
      </button>
    </li>
  );
}

function ColumnHeader() {
  const cls =
    "font-mono text-[9px] uppercase leading-none tracking-[0.12em] text-muted-foreground";
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-border pb-2">
      <span className={cls}>Domain</span>
      <span className="flex shrink-0 items-baseline gap-4">
        <span className={cn(cls, "w-8 text-right")}>Ment.</span>
        <span className={cn(cls, "w-[18px] text-center")} title="Editorial trust (0-5)">
          Tr
        </span>
        <span
          className={cn(cls, "w-[18px] text-center")}
          title="Audience reach (0-5)"
        >
          Re
        </span>
      </span>
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] text-text-tertiary">{children}</div>
  );
}

function CountryFlag({
  iso2,
  confidence,
}: {
  iso2: string | null;
  confidence: CountryConfidence | null;
}) {
  if (!iso2) {
    return (
      <span
        aria-hidden
        className="w-4 shrink-0 text-center font-mono text-[11px] text-text-tertiary"
      >
        —
      </span>
    );
  }
  const flag = iso2ToFlagEmoji(iso2);
  const tip = `${countryName(iso2)} (${iso2}) · ${formatConfidence(confidence)}`;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={200}
        closeDelay={100}
        render={
          <span
            aria-label={tip}
            className="w-4 shrink-0 text-center text-[14px] leading-none"
          >
            {flag}
          </span>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={4} side="top">
          <Tooltip.Popup
            className={cn(
              "z-50 border border-border bg-card px-2 py-1",
              "font-mono text-[11px] text-text-secondary outline-none",
              "duration-100 data-[instant]:duration-0",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            )}
          >
            {tip}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
