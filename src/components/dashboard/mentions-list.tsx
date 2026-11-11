"use client";

import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChevronDown, Loader2, Search, Sparkles, X } from "lucide-react";
import { Tooltip } from "@base-ui/react/tooltip";

import { apiClient } from "@/lib/api";
import type {
  Mention,
  MentionsListResponse,
  ScopeParam,
  StanceLabel,
} from "@/lib/types";
import type { DateWindow } from "@/lib/period";
import { FAVORABILITY_LABEL, FAVORABILITY_TOOLTIP } from "@/lib/favorability";
import { KickerLabel } from "@/components/ui/kicker-label";
import { SentimentPill } from "@/components/ui/sentiment-pill";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type StanceFilter = "all" | StanceLabel;
// Enrichment runs as one nightly batch (submit 22:00 UTC, verdicts land
// 07:00 UTC), so the newest-first feed always opens on rows the pipeline
// hasn't reached yet. This filter is how you get to what *has* been
// analyzed without scrolling past a day of pending rows.
type EnrichedFilter = "all" | "enriched" | "pending";
export type SourceFilter = "all" | "gn" | "gdelt" | "firehose" | "rss";
const STANCE_OPTIONS: { key: StanceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "supportive", label: "Favorable" },
  { key: "critical", label: "Unfavorable" },
  { key: "neutral", label: "Neutral" },
  { key: "mixed", label: "Mixed" },
];

const SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "gn", label: "Google News" },
  { key: "gdelt", label: "GDELT" },
  // "Firehose" is hidden for now — we don't ingest from that source yet.
  // The filter type + backend wiring stay intact so it can be re-enabled
  // by simply un-commenting this line.
  // { key: "firehose", label: "Firehose" },
  { key: "rss", label: "RSS" },
];

// "Pending" mirrors the backend's own vocabulary for `enriched=false`
// (enriched_at IS NULL). Note it also holds rows the batch will never
// reach — below the trust/reach gate, or body fetch blocked.
const ENRICHED_OPTIONS: { key: EnrichedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "enriched", label: "Analysed" },
  { key: "pending", label: "Not analysed yet" },
];

export function MentionsList({
  scope,
  win,
  topicNames,
  domain,
  country,
  source,
  onChangeSource,
  onClearDomain,
}: {
  scope: ScopeParam | null;
  win: DateWindow;
  /** id → short narrative name, for the per-article chips in group scope. */
  topicNames: Map<number, string>;
  domain: string | null;
  country: string | null;
  source: SourceFilter;
  onChangeSource: (v: SourceFilter) => void;
  onClearDomain: () => void;
}) {
  const enabled = scope !== null;
  // Same window as the KPIs and charts (drilled-down day included).
  const curFrom = win.from;
  const curTo = win.to;
  const isGroup = typeof scope === "object" && scope !== null && "group_id" in scope;

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [stance, setStance] = useState<StanceFilter>("all");
  const [enriched, setEnriched] = useState<EnrichedFilter>("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [
    debounced,
    scope,
    domain,
    country,
    curFrom,
    curTo,
    source,
    stance,
    enriched,
  ]);

  const queryKey = [
    "mentions",
    scope,
    debounced,
    domain,
    country,
    source,
    stance,
    enriched,
    page,
    curFrom,
    curTo,
  ] as const;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      apiClient.mentions({
        scope: scope!,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        search: debounced || undefined,
        source_domain: domain || undefined,
        country_iso2: country || undefined,
        source: source === "all" ? undefined : source,
        stance_label: stance === "all" ? undefined : stance,
        enriched: enriched === "all" ? undefined : enriched === "enriched",
        date_from: curFrom,
        date_to: curTo,
      }),
    enabled,
    placeholderData: keepPreviousData,
  });

  const hasActiveFilters =
    source !== "all" ||
    stance !== "all" ||
    enriched !== "all" ||
    domain !== null ||
    debounced !== "";

  const resetFilters = () => {
    onChangeSource("all");
    setStance("all");
    setEnriched("all");
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
    <div className="bg-card p-5">
      <div className="flex items-center justify-between">
        <KickerLabel>Articles</KickerLabel>
        <div className="font-mono text-[11px] text-text-tertiary tabular-nums">
          {total > 0 && `${total.toLocaleString()} total`}
        </div>
      </div>

      {/* Everyday filters in one row (search + favorability); the
          technical ones (which collector, analysis state) sit in compact
          dropdowns on the right. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles..."
              className={cn(
                "h-8 w-full border border-border bg-card pr-2 pl-7 sm:w-64",
                "font-mono text-[11px] text-foreground placeholder:text-text-tertiary",
                "outline-none transition-colors hover:border-strong focus:border-strong",
              )}
            />
          </div>
          <ToggleGroup
            label="Favorability"
            title={FAVORABILITY_TOOLTIP}
            value={stance}
            onChange={setStance}
            options={STANCE_OPTIONS}
          />
          {domain && (
            <button
              type="button"
              onClick={onClearDomain}
              title="Clear media filter"
              className={cn(
                "group inline-flex h-8 items-center gap-1.5 border border-strong bg-elevated pr-1 pl-2",
                "font-mono text-[11px] text-foreground transition-colors hover:border-strong hover:bg-overlay",
              )}
            >
              <span className="text-text-tertiary">media:</span>
              <span>{domain}</span>
              <X className="size-3 text-text-tertiary transition-colors group-hover:text-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownFilter
            label="Source"
            value={source}
            onChange={onChangeSource}
            options={SOURCE_OPTIONS}
          />
          <DropdownFilter
            label="Analysis"
            value={enriched}
            onChange={setEnriched}
            options={ENRICHED_OPTIONS}
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className={cn(
                "ml-1 font-mono text-[11px] uppercase tracking-[0.1em]",
                "text-text-secondary transition-colors hover:text-foreground",
              )}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        {error ? (
          <div className="flex items-center gap-3 font-mono text-[11px] text-text-secondary">
            <span>Failed to load articles</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="border border-border bg-elevated px-2 py-0.5 text-text-secondary hover:border-strong hover:text-foreground"
            >
              retry
            </button>
          </div>
        ) : !enabled || isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyMessage>
            {enriched === "enriched"
              ? "Nothing analyzed yet in this period — the nightly batch runs at 22:00 UTC and verdicts land at 07:00 UTC."
              : "No articles in selected period."}
          </EmptyMessage>
        ) : (
          <ul
            className={cn(
              "divide-y divide-border",
              isFetching && "opacity-60 transition-opacity",
            )}
          >
            {items.map((m) => (
              <MentionRow
                key={m.id}
                mention={m}
                listQueryKey={queryKey}
                narratives={
                  isGroup
                    ? (m.topic_ids ?? []).map((id) => topicNames.get(id) ?? `#${id}`)
                    : []
                }
              />
            ))}
          </ul>
        )}
      </div>

      {enabled && total > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <div className="font-mono text-[11px] text-text-tertiary tabular-nums">
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
  narratives,
}: {
  mention: Mention;
  listQueryKey: readonly unknown[];
  /** Narrative chips — only filled for "All narratives" (group) scope. */
  narratives: string[];
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
    <li className="-mx-2 px-2 py-3 transition-colors hover:bg-elevated/60">
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] text-text-tertiary">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{mention.source_domain ?? "—"}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{ts}</span>
          {previewIsSummary && (
            <>
              <span aria-hidden>·</span>
              <span
                className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-success"
                title="Title and preview generated by the enrichment pipeline."
              >
                Enriched
              </span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mention.enrichment_basis === "title_only" && (
            <span
              title="Paywalled outlet — favorability scored from the headline and standfirst only"
              className="border border-border px-1 py-px font-mono text-[9px] uppercase leading-none tracking-[0.1em] text-text-tertiary"
            >
              title only
            </span>
          )}
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
          "mt-1.5 block w-full text-left text-[14px] leading-snug text-foreground",
          mention.url
            ? "cursor-pointer hover:underline underline-offset-2"
            : "cursor-default",
        )}
      >
        {mention.title ?? "(untitled)"}
      </button>

      {narratives.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {narratives.map((name) => (
            <span
              key={name}
              className="border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {previewText && (
        <div
          className={cn(
            "mt-1 leading-snug",
            previewIsSummary
              ? "text-[12px] text-text-secondary"
              : "truncate font-mono text-[11px] text-text-tertiary",
          )}
        >
          {previewText}
        </div>
      )}

      {error && (
        <div className="mt-1 font-mono text-[10px] text-danger">{error}</div>
      )}
    </li>
  );
}

type PillVariant = "positive" | "negative" | "neutral" | "mixed" | "muted";

const STANCE_PILL: Record<
  StanceLabel,
  { variant: PillVariant; label: string }
> = {
  supportive: { variant: "positive", label: FAVORABILITY_LABEL.supportive },
  critical: { variant: "negative", label: FAVORABILITY_LABEL.critical },
  neutral: { variant: "neutral", label: FAVORABILITY_LABEL.neutral },
  mixed: { variant: "mixed", label: FAVORABILITY_LABEL.mixed },
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
    `${label} — ${FAVORABILITY_TOOLTIP} · ${confidence}` +
    (framing ? ` · framing: ${framing}` : "");
  const card = mention.claim_card;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={150}
        closeDelay={100}
        render={
          // `title` attr fallback for keyboard users + the few cases
          // where the styled popup is occluded; intentionally lossy
          // (no claim card content) — popup is the canonical surface.
          <span title={tip}>
            <SentimentPill variant={variant}>{label}</SentimentPill>
          </span>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner className="z-[100]" sideOffset={4} side="top" align="end">
          <Tooltip.Popup
            className={cn(
              // Wider cap when card present so 3-5 bullets aren't squished;
              // legacy tip-only path keeps the original max-w-xs width.
              card ? "max-w-md" : "max-w-xs",
              "z-50 border border-border bg-overlay px-2.5 py-2",
              "font-mono text-[11px] leading-relaxed text-text-secondary outline-none",
              "duration-100 data-[instant]:duration-0",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            )}
          >
            <div>{tip}</div>
            {card && <ClaimCardBlock card={card} />}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function ClaimCardBlock({ card }: { card: NonNullable<Mention["claim_card"]> }) {
  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
      {card.headline_claim && (
        <div className="text-foreground">{card.headline_claim}</div>
      )}
      {card.key_claims.length > 0 && (
        <ul className="ml-3 list-disc space-y-0.5 text-text-secondary">
          {card.key_claims.slice(0, 5).map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
      {card.stance_evidence && (
        <div className="border-l-2 border-strong pl-2 italic text-text-secondary">
          “{card.stance_evidence}”
        </div>
      )}
      {(card.key_entities.length > 0 || card.framing_tags.length > 0) && (
        <div className="flex flex-wrap gap-1 text-[10px] text-text-tertiary">
          {card.key_entities.slice(0, 6).map((e) => (
            <span
              key={`e-${e}`}
              className="border border-border bg-card px-1 py-0.5"
            >
              {e}
            </span>
          ))}
          {card.framing_tags.slice(0, 4).map((t) => (
            <span
              key={`t-${t}`}
              className="border border-border bg-card px-1 py-0.5 italic"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
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
              "border border-border bg-card text-text-tertiary transition-colors",
              "hover:border-strong hover:text-foreground",
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
        <Tooltip.Positioner className="z-[100]" sideOffset={4} side="top" align="end">
          <Tooltip.Popup
            className={cn(
              "z-50 border border-border bg-overlay px-2 py-1.5",
              "font-mono text-[11px] leading-relaxed text-text-secondary outline-none",
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
  title,
  value,
  onChange,
  options,
}: {
  label: string;
  title?: string;
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-2" title={title}>
      <span className="font-mono text-[9px] uppercase leading-none tracking-[0.12em] text-text-tertiary">
        {label}
      </span>
      <div className="inline-flex items-center gap-0.5 border border-border bg-card p-0.5">
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
                  ? "bg-foreground text-primary-foreground"
                  : "bg-transparent text-text-tertiary hover:text-foreground",
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

/** A compact single-choice filter; highlighted when not on its default. */
function DropdownFilter<T extends string>({
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
  const current = options.find((o) => o.key === value) ?? options[0];
  const isDefault = value === options[0].key;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 border px-2 font-mono text-[11px] outline-none transition-colors",
          isDefault
            ? "border-border text-text-tertiary hover:border-strong hover:text-foreground"
            : "border-strong bg-elevated text-foreground",
        )}
      >
        <span>{label}:</span>
        <span className={isDefault ? undefined : "text-foreground"}>{current.label}</span>
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="min-w-40 border border-border bg-card p-0 text-foreground ring-0 shadow-none"
      >
        {options.map((o) => (
          <DropdownMenuItem
            key={o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "flex cursor-default items-center px-3 py-2 font-mono text-[11px]",
              "focus:bg-elevated focus:text-foreground",
              o.key === value && "bg-elevated",
            )}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
        "border border-border bg-card px-2 py-1 font-mono text-[11px] transition-colors",
        disabled
          ? "cursor-not-allowed text-text-tertiary opacity-50"
          : "text-text-secondary hover:border-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] text-text-tertiary">{children}</div>
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
