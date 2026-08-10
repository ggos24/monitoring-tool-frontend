"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { NarrativeStateBadge } from "@/components/narratives/narrative-state-badge";
import {
  formatDeltaPp,
  formatShare,
  isActiveObservation,
  narrativePresentation,
  observationForPeriod,
  observationMomentumTag,
  sortPeriods,
} from "@/lib/narrative-view";
import type { NarrativePeriod, NarrativeSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "name" | "share" | "delta" | "reach" | "mentions" | "state";
type SortDirection = "asc" | "desc";

export function NarrativeList({
  periods,
  narratives,
  selectedId,
  onSelect,
}: {
  periods: NarrativePeriod[];
  narratives: NarrativeSummary[];
  selectedId: string | null;
  onSelect: (narrativeId: string) => void;
}) {
  const orderedPeriods = useMemo(() => sortPeriods(periods), [periods]);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "share",
    direction: "desc",
  });
  const rows = useMemo(
    () => sortRows(narratives, orderedPeriods, sort.key, sort.direction),
    [narratives, orderedPeriods, sort],
  );

  const changeSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key
          ? current.direction === "desc"
            ? "asc"
            : "desc"
          : key === "name"
            ? "asc"
            : "desc",
    }));
  };

  if (rows.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center border border-border bg-card px-6 text-center font-mono text-[11px] text-text-tertiary">
        No narratives were observed in the selected history range.
      </div>
    );
  }

  return (
    <section className="border border-border bg-card" aria-labelledby="narrative-list-heading">
      <div className="border-b border-border px-4 py-3">
        <h2
          id="narrative-list-heading"
          className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary"
        >
          Narratives list
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Operational view of the latest analytical period.
        </p>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead className="bg-elevated">
            <tr>
              <SortableHeader label="Narrative" sortKey="name" sort={sort} onSort={changeSort} />
              <SortableHeader label="Share" sortKey="share" sort={sort} onSort={changeSort} />
              <SortableHeader label="Δ share" sortKey="delta" sort={sort} onSort={changeSort} />
              <SortableHeader label="Reach" sortKey="reach" sort={sort} onSort={changeSort} />
              <SortableHeader label="Mentions" sortKey="mentions" sort={sort} onSort={changeSort} />
              <SortableHeader label="State" sortKey="state" sort={sort} onSort={changeSort} />
              <th className="px-3 py-2 font-mono text-[9px] font-normal uppercase tracking-[0.1em] text-text-tertiary">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((narrative) => (
              <NarrativeTableRow
                key={narrative.narrative_id}
                narrative={narrative}
                periods={orderedPeriods}
                selected={narrative.narrative_id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border md:hidden">
        <div className="flex items-center justify-between gap-3 bg-elevated px-3 py-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
            Sort
          </span>
          <select
            value={`${sort.key}:${sort.direction}`}
            onChange={(event) => {
              const [key, direction] = event.target.value.split(":") as [
                SortKey,
                SortDirection,
              ];
              setSort({ key, direction });
            }}
            className="h-8 border border-border bg-card px-2 font-mono text-[11px] text-foreground outline-none focus:border-strong"
          >
            <option value="share:desc">Mention share</option>
            <option value="delta:desc">Largest increase</option>
            <option value="mentions:desc">Mentions</option>
            <option value="name:asc">Name</option>
          </select>
        </div>
        {rows.map((narrative) => (
          <NarrativeMobileRow
            key={narrative.narrative_id}
            narrative={narrative}
            periods={orderedPeriods}
            selected={narrative.narrative_id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function NarrativeTableRow({
  narrative,
  periods,
  selected,
  onSelect,
}: {
  narrative: NarrativeSummary;
  periods: NarrativePeriod[];
  selected: boolean;
  onSelect: (narrativeId: string) => void;
}) {
  const view = narrativePresentation(narrative, periods);
  const momentum = observationMomentumTag(view.current);
  return (
    <tr
      className={cn(
        "border-t border-border [content-visibility:auto] [contain-intrinsic-size:auto_64px]",
        selected ? "bg-elevated" : "hover:bg-elevated/60",
      )}
    >
      <td className="max-w-sm px-3 py-3 align-top">
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => onSelect(narrative.narrative_id)}
          className="block w-full text-left focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-2 text-xs leading-snug text-foreground">
            {narrative.name}
          </span>
          {narrative.claim && (
            <span className="mt-1 line-clamp-1 block text-[11px] text-text-tertiary">
              {narrative.claim}
            </span>
          )}
        </button>
      </td>
      <MetricCell value={formatShare(view.current?.share_of_voice)} />
      <MetricCell
        value={formatDeltaPp(view.shareDelta)}
        tone={view.shareDelta == null ? "muted" : view.shareDelta >= 0 ? "positive" : "warning"}
      />
      <MetricCell value={formatShare(view.current?.reach_sov)} />
      <MetricCell value={formatInteger(view.current?.n_mentions)} />
      <td className="px-3 py-3 align-top">
        <NarrativeStateBadge state={view.state} label={view.label} />
        {momentum && (
          <div className="mt-1 font-mono text-[9px] text-text-tertiary">
            momentum · {momentum}
          </div>
        )}
      </td>
      <td className="px-3 py-3 align-middle">
        <NarrativeSparkline narrative={narrative} periods={periods} />
      </td>
    </tr>
  );
}

function NarrativeMobileRow({
  narrative,
  periods,
  selected,
  onSelect,
}: {
  narrative: NarrativeSummary;
  periods: NarrativePeriod[];
  selected: boolean;
  onSelect: (narrativeId: string) => void;
}) {
  const view = narrativePresentation(narrative, periods);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(narrative.narrative_id)}
      className={cn(
        "block w-full px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        selected ? "bg-elevated" : "bg-card",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="line-clamp-2 text-xs leading-snug text-foreground">
          {narrative.name}
        </span>
        <NarrativeStateBadge state={view.state} label={view.label} />
      </span>
      {narrative.claim && (
        <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-text-tertiary">
          {narrative.claim}
        </span>
      )}
      <span className="mt-3 grid grid-cols-3 gap-px bg-border">
        <MobileMetric label="Share" value={formatShare(view.current?.share_of_voice)} />
        <MobileMetric label="Δ share" value={formatDeltaPp(view.shareDelta)} />
        <MobileMetric label="Mentions" value={formatInteger(view.current?.n_mentions)} />
      </span>
      <span className="mt-2 block">
        <NarrativeSparkline narrative={narrative} periods={periods} wide />
      </span>
    </button>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-3 py-2 font-normal">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-text-tertiary",
        )}
      >
        {label}
        {active &&
          (sort.direction === "desc" ? (
            <ArrowDown className="size-3" aria-hidden />
          ) : (
            <ArrowUp className="size-3" aria-hidden />
          ))}
      </button>
    </th>
  );
}

function MetricCell({
  value,
  tone = "default",
}: {
  value: string;
  tone?: "default" | "positive" | "warning" | "muted";
}) {
  return (
    <td
      className={cn(
        "px-3 py-3 align-top font-mono text-[11px] tabular-nums",
        tone === "default" && "text-text-secondary",
        tone === "positive" && "text-success",
        tone === "warning" && "text-warning",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {value}
    </td>
  );
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="bg-elevated px-2 py-1.5">
      <span className="block font-mono text-[8px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </span>
      <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-foreground">
        {value}
      </span>
    </span>
  );
}

function NarrativeSparkline({
  narrative,
  periods,
  wide = false,
}: {
  narrative: NarrativeSummary;
  periods: NarrativePeriod[];
  wide?: boolean;
}) {
  const values = periods.map((period) => {
    const observation = observationForPeriod(narrative, period);
    return isActiveObservation(observation) ? observation.share_of_voice : null;
  });
  const segments = sparklineSegments(values, 92, 24);
  return (
    <svg
      viewBox="0 0 92 24"
      className={wide ? "h-6 w-full" : "h-6 w-24"}
      role="img"
      aria-label={`${narrative.name} mention-share trend`}
      preserveAspectRatio="none"
    >
      <path d="M0 23.5H92" stroke="var(--border)" strokeWidth="1" />
      {segments.map((points, index) => (
        <polyline
          key={index}
          points={points}
          fill="none"
          stroke="var(--accent-success)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function sparklineSegments(
  values: Array<number | null>,
  width: number,
  height: number,
): string[] {
  const numericValues = values.filter((value): value is number => value != null);
  const max = Math.max(...numericValues, 0.01);
  const x = (index: number) =>
    values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
  const y = (value: number) => height - 2 - (value / max) * (height - 4);
  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  values.forEach((value, index) => {
    if (value == null) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push([x(index), y(value)]);
  });
  if (current.length > 0) segments.push(current);
  return segments.map((segment) => segment.map(([px, py]) => `${px},${py}`).join(" "));
}

function sortRows(
  narratives: NarrativeSummary[],
  periods: NarrativePeriod[],
  key: SortKey,
  direction: SortDirection,
): NarrativeSummary[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...narratives].sort((left, right) => {
    const leftView = narrativePresentation(left, periods);
    const rightView = narrativePresentation(right, periods);
    let comparison = 0;
    if (key === "name") comparison = left.name.localeCompare(right.name);
    if (key === "share") {
      comparison = numeric(leftView.current?.share_of_voice) - numeric(rightView.current?.share_of_voice);
    }
    if (key === "delta") comparison = numeric(leftView.shareDelta) - numeric(rightView.shareDelta);
    if (key === "reach") {
      comparison = numeric(leftView.current?.reach_sov) - numeric(rightView.current?.reach_sov);
    }
    if (key === "mentions") {
      comparison = numeric(leftView.current?.n_mentions) - numeric(rightView.current?.n_mentions);
    }
    if (key === "state") comparison = leftView.label.localeCompare(rightView.label);
    if (comparison !== 0) return comparison * sign;
    return left.name.localeCompare(right.name);
  });
}

function numeric(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
}

function formatInteger(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : String(Math.round(value));
}
