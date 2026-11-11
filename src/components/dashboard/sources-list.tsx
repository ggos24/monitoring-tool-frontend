"use client";

import { useQuery } from "@tanstack/react-query";
import { Tooltip } from "@base-ui/react/tooltip";

import { apiClient } from "@/lib/api";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import { countryName, formatConfidence, iso2ToFlagEmoji } from "@/lib/country";
import type { DateWindow } from "@/lib/period";
import { CountDelta } from "@/components/dashboard/top-geo-card";
import type { CountryConfidence, ScopeParam } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SourcesList({
  scope,
  win,
  compare,
  country,
  source,
  selectedDomain,
  onToggleDomain,
}: {
  scope: ScopeParam | null;
  win: DateWindow;
  compare: boolean;
  country: string | null;
  source: "all" | "gn" | "gdelt" | "firehose" | "rss";
  selectedDomain: string | null;
  onToggleDomain: (domain: string) => void;
}) {
  const enabled = scope !== null;
  // /api/stats/sources caps `limit` at 50 (422 above that). The panel is as
  // tall as the article list next to it and scrolls inside, so show the cap.
  const LIMIT = 50;
  const PREV_LIMIT = 50;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sources", scope, country, source, LIMIT, win.from, win.to],
    queryFn: () =>
      apiClient.topSources(scope!, win.days, LIMIT, country, {
        source: source === "all" ? undefined : source,
        date_from: win.from,
        date_to: win.to,
      }),
    enabled,
  });

  // Previous window's top 50: a domain outside it reads as "new" (the
  // backend cap; in practice a query has fewer than 50 media).
  const previous = useQuery({
    queryKey: ["sources", scope, country, source, PREV_LIMIT, win.prevFrom, win.prevTo],
    queryFn: () =>
      apiClient.topSources(scope!, win.days, PREV_LIMIT, country, {
        source: source === "all" ? undefined : source,
        date_from: win.prevFrom,
        date_to: win.prevTo,
      }),
    enabled: enabled && compare,
  });
  const prevByDomain = previous.data
    ? new Map(previous.data.map((s) => [s.domain, s.count] as const))
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card p-5">
      <KickerLabel>Top media</KickerLabel>
      <div className="mt-1 mb-4 text-xs text-text-tertiary">
        {data && data.length > 0 && data.length < LIMIT
          ? `All ${data.length} media by number of articles`
          : `Top ${LIMIT} media by number of articles`}
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
          <div className="min-h-0 flex-1 overflow-y-auto max-lg:max-h-[480px]">
            <div className="sticky top-0 z-10 bg-card">
              <ColumnHeader showDelta={prevByDomain !== null} />
            </div>
            <ul className="-mx-2">
              {data.map((s) => (
                <SourceRow
                  key={s.domain}
                  domain={s.domain}
                  count={s.count}
                  countryIso2={s.country_iso2 ?? null}
                  countryConfidence={s.country_confidence ?? null}
                  previous={prevByDomain ? (prevByDomain.get(s.domain) ?? 0) : null}
                  prevLabel={win.prevLabel}
                  isActive={s.domain === selectedDomain}
                  onToggle={onToggleDomain}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceRow({
  domain,
  count,
  countryIso2,
  countryConfidence,
  previous,
  prevLabel,
  isActive,
  onToggle,
}: {
  domain: string;
  count: number;
  countryIso2: string | null;
  countryConfidence: CountryConfidence | null;
  previous: number | null;
  prevLabel: string;
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
          <span className="flex shrink-0 items-center gap-3">
            <span className={cn(COUNT_COL, "font-mono text-xs font-medium text-foreground tabular-nums")}>
              {count}
            </span>
            {previous !== null && (
              <CountDelta current={count} previous={previous} title={prevLabel} className={CHANGE_COL} />
            )}
          </span>
        </div>
      </button>
    </li>
  );
}

// Header and rows share these widths, so labels sit over their numbers.
const COUNT_COL = "w-16 text-right";
const CHANGE_COL = "w-14 text-right";

function ColumnHeader({ showDelta }: { showDelta: boolean }) {
  const cls =
    "font-mono text-[11px] uppercase leading-none tracking-[0.12em] text-text-tertiary";
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-border pb-2">
      <span className={cls}>Media</span>
      <span className="flex shrink-0 items-baseline gap-3">
        <span className={cn(cls, COUNT_COL)}>Articles</span>
        {showDelta && (
          <span className={cn(cls, CHANGE_COL)} title="Change vs previous period">
            Change
          </span>
        )}
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
        <Tooltip.Positioner className="z-[100]" sideOffset={4} side="top">
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
