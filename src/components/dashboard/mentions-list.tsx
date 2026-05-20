"use client";

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import { apiClient } from "@/lib/api";
import { KickerLabel } from "@/components/ui/kicker-label";
import { SentimentPill } from "@/components/ui/sentiment-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type SentimentFilter = "all" | "positive" | "neutral" | "negative";
type SourceFilter = "all" | "gn" | "gdelt" | "firehose" | "rss";
type QualityFilter = "all" | "trusted" | "suspect" | "propaganda";

const SENTIMENT_OPTIONS: { key: SentimentFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "positive", label: "Positive" },
  { key: "neutral", label: "Neutral" },
  { key: "negative", label: "Negative" },
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
  onClearDomain,
}: {
  topicId: number | null;
  domain: string | null;
  country: string | null;
  onClearDomain: () => void;
}) {
  const enabled = topicId !== null;

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [quality, setQuality] = useState<QualityFilter>("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debounced, topicId, domain, country, source, quality, sentiment]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [
      "mentions",
      topicId,
      debounced,
      domain,
      country,
      source,
      quality,
      page,
    ],
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
      }),
    enabled,
    placeholderData: keepPreviousData,
  });

  const hasActiveFilters =
    source !== "all" ||
    quality !== "all" ||
    sentiment !== "all" ||
    domain !== null ||
    debounced !== "";

  const resetFilters = () => {
    setSource("all");
    setQuality("all");
    setSentiment("all");
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ToggleGroup
          label="Source"
          value={source}
          onChange={setSource}
          options={SOURCE_OPTIONS}
        />
        <ToggleGroup
          label="Quality"
          value={quality}
          onChange={setQuality}
          options={QUALITY_OPTIONS}
        />
        <ToggleGroup
          label="Sentiment"
          value={sentiment}
          onChange={setSentiment}
          options={SENTIMENT_OPTIONS}
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
              <MentionRow key={m.id} mention={m} />
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
}: {
  mention: {
    id: number;
    url: string | null;
    title: string | null;
    body: string | null;
    source_domain: string | null;
    published_at: string;
  };
}) {
  const onClick = () => {
    if (mention.url) window.open(mention.url, "_blank", "noopener,noreferrer");
  };
  const ts = formatTimestamp(mention.published_at);
  return (
    <li
      onClick={onClick}
      className={cn(
        "-mx-2 cursor-pointer px-2 py-3 transition-colors hover:bg-zinc-900/50",
      )}
    >
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] text-zinc-600">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{mention.source_domain ?? "—"}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{ts}</span>
        </div>
        <SentimentPill variant="neutral">Neutral</SentimentPill>
      </div>
      <div className="mt-1.5 text-[13px] text-zinc-50">
        {mention.title ?? "(untitled)"}
      </div>
      {mention.body && (
        <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-600">
          {mention.body}
        </div>
      )}
    </li>
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
