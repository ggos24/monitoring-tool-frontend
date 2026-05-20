"use client";

import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, Search, Sparkles, X } from "lucide-react";
import { Tooltip } from "@base-ui/react/tooltip";

import { apiClient } from "@/lib/api";
import type { Mention, MentionsListResponse, StanceLabel } from "@/lib/types";
import { KickerLabel } from "@/components/ui/kicker-label";
import { SentimentPill } from "@/components/ui/sentiment-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type StanceFilter = "all" | StanceLabel;
export type SourceFilter = "all" | "gn" | "gdelt" | "firehose" | "rss";
export type QualityFilter = "all" | "trusted" | "suspect" | "propaganda";

const STANCE_OPTIONS: { key: StanceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "supportive", label: "Supportive" },
  { key: "critical", label: "Critical" },
  { key: "neutral", label: "Neutral" },
  { key: "mixed", label: "Mixed" },
];

const SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "gn", label: "Google News" },
  { key: "gdelt", label: "GDELT" },
  { key: "firehose", label: "Firehose" },
  { key: "rss", label: "RSS" },
];

const QUALITY_OPTIONS: { key: QualityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trusted", label: "Trusted" },
  { key: "suspect", label: "Suspect" },
  { key: "propaganda", label: "Propaganda" },
];

export function MentionsList({
  topicId,
  domain,
  country,
  source,
  quality,
  onChangeSource,
  onChangeQuality,
  onClearDomain,
}: {
  topicId: number | null;
  domain: string | null;
  country: string | null;
  source: SourceFilter;
  quality: QualityFilter;
  onChangeSource: (v: SourceFilter) => void;
  onChangeQuality: (v: QualityFilter) => void;
  onClearDomain: () => void;
}) {
  const enabled = topicId !== null;

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [stance, setStance] = useState<StanceFilter>("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debounced, topicId, domain, country, source, quality, stance]);

  const queryKey = [
    "mentions",
    topicId,
    debounced,
    domain,
    country,
    source,
    quality,
    stance,
    page,
  ] as const;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      apiClient.mentions({
        topic_id: topicId!,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        search: debounced || undefined,
        source_domain: domain || undefined,
        country_iso2: country || undefined,
        source: source === "all" ? undefined : source,
        score_band: quality === "all" ? undefined : quality,
        stance_label: stance === "all" ? undefined : stance,
      }),
    enabled,
    placeholderData: keepPreviousData,
  });

  const hasActiveFilters =
    source !== "all" ||
    quality !== "all" ||
    stance !== "all" ||
    domain !== null ||
    debounced !== "";

  const resetFilters = () => {
    onChangeSource("all");
    onChangeQuality("all");
    setStance("all");
    setSearch("");
    if (domain) onClearDomain();
  };

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const start = items.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = page * PAGE_SIZE + items.length;
  const canPrev = page > 0;
  const canNext = (page + 1) * PAGE_SIZE < total;

  return (
    <div className="bg-zinc-950 p-5">
      <div className="flex items-center justify-between">
        <KickerLabel>Mentions</KickerLabel>
        <div className="font-mono text-[11px] text-zinc-600 tabular-nums">
          {total > 0 && `${total.toLocaleString()} total`}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or body..."
              className={cn(
                "h-8 w-full border border-zinc-800 bg-zinc-950 pr-2 pl-7 sm:w-72",
                "font-mono text-[11px] text-zinc-50 placeholder:text-zinc-700",
                "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
              )}
            />
          </div>
          {domain && (
            <button
              type="button"
              onClick={onClearDomain}
              title="Clear domain filter"
              className={cn(
                "group inline-flex h-8 items-center gap-1.5 border border-zinc-700 bg-zinc-900 pr-1 pl-2",
                "font-mono text-[11px] text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-800",
              )}
            >
              <span className="text-zinc-500">domain:</span>
              <span>{domain}</span>
              <X className="size-3 text-zinc-500 transition-colors group-hover:text-zinc-200" />
            </button>
          )}
          <ToggleGroup
            label="Source"
            value={source}
            onChange={onChangeSource}
            options={SOURCE_OPTIONS}
          />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className={cn(
              "font-mono text-[11px] uppercase tracking-[0.1em]",
              "text-zinc-500 transition-colors hover:text-zinc-50",
            )}
          >
            Reset
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <ToggleGroup
          label="Quality"
          value={quality}
          onChange={onChangeQuality}
          options={QUALITY_OPTIONS}
        />
        <ToggleGroup
          label="Stance"
          value={stance}
          onChange={setStance}
          options={STANCE_OPTIONS}
        />
      </div>

      <div className="mt-4">
        {!enabled ? (
          <EmptyMessage>Select a topic to load mentions.</EmptyMessage>
        ) : error ? (
          <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
            <span>Failed to load mentions</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-300 hover:border-zinc-700 hover:text-zinc-50"
            >
              retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-zinc-900" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyMessage>No mentions in selected period.</EmptyMessage>
        ) : (
          <ul
            className={cn(
              "divide-y divide-zinc-800",
              isFetching && "opacity-60 transition-opacity",
            )}
          >
            {items.map((m) => (
              <MentionRow key={m.id} mention={m} listQueryKey={queryKey} />
            ))}
          </ul>
        )}
      </div>

      {enabled && total > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
          <div className="font-mono text-[11px] text-zinc-600 tabular-nums">
            Showing {start}–{end} of {total.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <PageButton
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Prev
            </PageButton>
            <PageButton
              disabled={!canNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </PageButton>
          </div>
        </div>
      )}
    </div>
  );
}

function MentionRow({
  mention,
  listQueryKey,
}: {
  mention: Mention;
  listQueryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const enrichMutation = useMutation({
    mutationFn: () => apiClient.enrichMention(mention.id),
    onSuccess: (updated) => {
      queryClient.setQueryData<MentionsListResponse | undefined>(
        listQueryKey,
        (prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((it) =>
                  it.id === updated.id ? updated : it,
                ),
              }
            : prev,
      );
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Analyze failed");
    },
  });

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const openArticle = () => {
    if (mention.url) window.open(mention.url, "_blank", "noopener,noreferrer");
  };

  const ts = formatTimestamp(mention.published_at);
  const isEnriched = mention.stance_label !== null;
  const previewText = mention.summary ?? mention.body ?? null;
  const previewIsSummary = mention.summary !== null;

  return (
    <li className="-mx-2 px-2 py-3 transition-colors hover:bg-zinc-900/50">
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] text-zinc-600">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{mention.source_domain ?? "—"}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{ts}</span>
          {previewIsSummary && (
            <>
              <span aria-hidden>·</span>
              <span
                className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500"
                title="Title and preview generated by the enrichment pipeline."
              >
                Enriched
              </span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StanceBadge mention={mention} />
          <EnrichButton
            isEnriched={isEnriched}
            isPending={enrichMutation.isPending}
            onClick={() => enrichMutation.mutate()}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={openArticle}
        disabled={!mention.url}
        className={cn(
          "mt-1.5 block w-full text-left text-[13px] text-zinc-50",
          mention.url
            ? "cursor-pointer hover:underline underline-offset-2"
            : "cursor-default",
        )}
      >
        {mention.title ?? "(untitled)"}
      </button>

      {previewText && (
        <div
          className={cn(
            "mt-1 leading-snug",
            previewIsSummary
              ? "text-[12px] text-zinc-300"
              : "truncate font-mono text-[11px] text-zinc-600",
          )}
        >
          {previewText}
        </div>
      )}

      {error && (
        <div className="mt-1 font-mono text-[10px] text-red-400">{error}</div>
      )}
    </li>
  );
}

type PillVariant = "positive" | "negative" | "neutral" | "mixed" | "muted";

const STANCE_PILL: Record<
  StanceLabel,
  { variant: PillVariant; label: string }
> = {
  supportive: { variant: "positive", label: "Supportive" },
  critical: { variant: "negative", label: "Critical" },
  neutral: { variant: "neutral", label: "Neutral" },
  mixed: { variant: "mixed", label: "Mixed" },
};

function StanceBadge({ mention }: { mention: Mention }) {
  if (!mention.stance_label) {
    return <SentimentPill variant="muted">Unscored</SentimentPill>;
  }
  const { variant, label } = STANCE_PILL[mention.stance_label];
  const confidence =
    mention.stance_confidence !== null
      ? `${Math.round(mention.stance_confidence * 100)}% confidence`
      : "no confidence score";
  const framing = mention.framing_label ?? null;
  const tip =
    `${label} stance toward topic · ${confidence}` +
    (framing ? ` · framing: ${framing}` : "");

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={150}
        closeDelay={100}
        render={
          <span title={tip}>
            <SentimentPill variant={variant}>{label}</SentimentPill>
          </span>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={4} side="top" align="end">
          <Tooltip.Popup
            className={cn(
              "z-50 max-w-xs border border-zinc-800 bg-zinc-950 px-2 py-1.5",
              "font-mono text-[11px] leading-relaxed text-zinc-300 outline-none",
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

function EnrichButton({
  isEnriched,
  isPending,
  onClick,
}: {
  isEnriched: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  const label = isPending
    ? "Analyzing…"
    : isEnriched
      ? "Re-analyze with LLM"
      : "Analyze with LLM";
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={150}
        closeDelay={100}
        render={
          <button
            type="button"
            onClick={onClick}
            disabled={isPending}
            aria-label={label}
            title={label}
            className={cn(
              "inline-flex size-6 cursor-pointer items-center justify-center",
              "border border-zinc-800 bg-zinc-950 text-zinc-500 transition-colors",
              "hover:border-zinc-700 hover:text-zinc-50",
              "disabled:cursor-wait disabled:opacity-60",
            )}
          >
            {isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
          </button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={4} side="top" align="end">
          <Tooltip.Popup
            className={cn(
              "z-50 border border-zinc-800 bg-zinc-950 px-2 py-1.5",
              "font-mono text-[11px] leading-relaxed text-zinc-300 outline-none",
              "duration-100 data-[instant]:duration-0",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            )}
          >
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function ToggleGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="font-mono text-[9px] uppercase leading-none tracking-[0.12em] text-zinc-400">
        {label}
      </span>
      <div className="inline-flex items-center gap-0.5 border border-zinc-800 bg-zinc-950 p-0.5">
        {options.map((opt) => {
          const isActive = opt.key === value;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={cn(
                "px-2 py-0.5 font-mono text-[11px] leading-none transition-colors",
                isActive
                  ? "bg-zinc-50 text-black"
                  : "bg-transparent text-zinc-600 hover:text-zinc-300",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[11px] transition-colors",
        disabled
          ? "cursor-not-allowed text-zinc-700"
          : "text-zinc-400 hover:border-zinc-700 hover:text-zinc-50",
      )}
    >
      {children}
    </button>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] text-zinc-500">{children}</div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}
