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
import { stagger } from "@/lib/motion";
import type {
  Mention,
  MentionsListResponse,
  ScopeParam,
  StanceLabel,
} from "@/lib/types";
import type { DateWindow } from "@/lib/period";
import { FAVORABILITY_LABEL, FAVORABILITY_TOOLTIP } from "@/lib/favorability";
import {
  ACTOR_TEXT,
  COVERAGE_TEXT,
  DIRECTION_TEXT,
  FACT_STATUS_TEXT,
  explainScore,
  signed,
  type ScoreExplanation,
} from "@/lib/score-explanation";
import { KickerLabel } from "@/components/ui/kicker-label";
import { RefreshLine } from "@/components/ui/refresh-line";
import { SentimentPill } from "@/components/ui/sentiment-pill";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

import type { SourceFilter, StanceFilter } from "@/lib/article-filters";
export type { SourceFilter, StanceFilter };
// Enrichment runs as one nightly batch (submit 22:00 UTC, verdicts land
// 07:00 UTC), so the newest-first feed always opens on rows the pipeline
// hasn't reached yet. This filter is how you get to what *has* been
// analyzed without scrolling past a day of pending rows.
type EnrichedFilter = "all" | "enriched" | "pending";
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
  { key: "pending", label: "Not analysed" },
];

export function MentionsList({
  scope,
  win,
  topicNames,
  domain,
  country,
  source,
  stance,
  onChangeStance,
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
  /** Tone filter — owned by the page so the tone block's rows can set it. */
  stance: StanceFilter;
  onChangeStance: (v: StanceFilter) => void;
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

  const { data, isLoading, isPlaceholderData, error, refetch } = useQuery({
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
    onChangeStance("all");
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

      {/* One row, nothing reflows when a filter changes: every control but
          the search box has a fixed width (Filters shows a count, not the
          value, Reset keeps its slot while hidden) and sits on the right, so
          the media chip only narrows the search box. The technical filters
          (collector, analysis state) share one menu to leave the row room. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-40 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles..."
              className={cn(
                "h-8 w-full border border-strong bg-card pr-2 pl-7",
                "font-mono text-[11px] text-foreground placeholder:text-text-tertiary",
                "outline-none transition-colors hover:border-text-tertiary focus:border-text-tertiary",
              )}
            />
          </div>
          {domain && (
            <button
              type="button"
              onClick={onClearDomain}
              title="Clear media filter"
              className={cn(
                "group inline-flex h-8 max-w-48 shrink-0 items-center gap-1.5 border border-strong bg-elevated pr-1 pl-2",
                "font-mono text-[11px] text-foreground transition-colors hover:border-strong hover:bg-overlay",
              )}
            >
              <span className="text-text-tertiary">media:</span>
              <span className="truncate">{domain}</span>
              <X className="size-3 shrink-0 text-text-tertiary transition-colors group-hover:text-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            label="Tone"
            title={FAVORABILITY_TOOLTIP}
            value={stance}
            onChange={onChangeStance}
            options={STANCE_OPTIONS}
          />
          <FiltersMenu
            sections={[
              {
                label: "Collected via",
                value: source,
                onChange: (v) => onChangeSource(v as SourceFilter),
                options: SOURCE_OPTIONS,
              },
              {
                label: "Analysis",
                value: enriched,
                onChange: (v) => setEnriched(v as EnrichedFilter),
                options: ENRICHED_OPTIONS,
              },
            ]}
          />
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            aria-hidden={!hasActiveFilters}
            tabIndex={hasActiveFilters ? undefined : -1}
            title="Reset filters"
            aria-label="Reset filters"
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center border border-strong",
              "text-text-secondary transition-colors hover:border-text-tertiary hover:text-foreground",
              !hasActiveFilters && "invisible",
            )}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="relative mt-4" data-refreshing={isPlaceholderData || undefined}>
        <RefreshLine active={isPlaceholderData} />
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
          // Row-shaped: source line, headline, narrative chip.
          <div className="divide-y divide-border" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="py-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="mt-2.5 h-4" style={{ width: `${52 + ((i * 29) % 36)}%` }} />
                <Skeleton className="mt-2.5 h-5 w-56" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyMessage>
            {enriched === "enriched"
              ? "Nothing analysed yet in this period — the nightly batch runs at 22:00 UTC and verdicts land at 07:00 UTC."
              : "No articles in selected period."}
          </EmptyMessage>
        ) : (
          <ul
            className="divide-y divide-border"
          >
            {items.map((m, i) => (
              <MentionRow
                key={m.id}
                index={i}
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

/** `www.reuters.com` → `reuters.com`, as the Top media list shows it. */
export function displayDomain(domain: string | null): string | null {
  return domain ? domain.replace(/^www\./i, "") : domain;
}

/**
 * Drops a trailing " - Publisher" (Google News appends it) when the tail is
 * the outlet's own name: "… - Reuters" on reuters.com. Any other tail stays.
 */
export function cleanTitle(title: string | null, domain: string | null): string | null {
  if (!title || !domain) return title;
  const m = title.match(/^(.*\S)\s+[-–—|]\s+([^-–—|]{2,40})$/);
  if (!m) return title;
  const squash = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const tail = squash(m[2]);
  const label = squash(displayDomain(domain)!.split(".")[0]);
  if (tail.length < 2 || label.length < 2) return title;
  return tail === label || tail === `the${label}` || `the${tail}` === label ? m[1] : title;
}

function MentionRow({
  index,
  mention,
  listQueryKey,
  narratives,
}: {
  /** Position on the page — staggers the row's entrance. */
  index: number;
  mention: Mention;
  listQueryKey: readonly unknown[];
  /** Narrative chips — only filled for "All queries" (group) scope. */
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
      setError(err instanceof Error ? err.message : "Analysis failed");
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
    <li
      className="animate-reveal -mx-2 px-2 py-3 transition-colors hover:bg-elevated/60"
      style={stagger(index)}
    >
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] text-text-tertiary">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{displayDomain(mention.source_domain) ?? "—"}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{ts}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mention.enrichment_basis === "title_only" && (
            <span
              title="Paywalled outlet — favorability scored from the headline and standfirst only"
              className="border border-border px-1 py-px font-mono text-[11px] uppercase leading-none tracking-[0.1em] text-text-tertiary"
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
        {cleanTitle(mention.title, mention.source_domain) ?? "(untitled)"}
      </button>

      {narratives.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {narratives.map((name) => (
            <span
              key={name}
              className="border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-text-tertiary"
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
        <div className="mt-1 font-mono text-[11px] text-danger">{error}</div>
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
    return <SentimentPill variant="muted">Not analysed</SentimentPill>;
  }
  const { variant, label } = STANCE_PILL[mention.stance_label];
  const explanation = explainScore({
    stance: mention.stance,
    stance_label: mention.stance_label,
    fact_status: mention.fact_status ?? null,
    coverage_label: mention.coverage_label ?? null,
    stance_detail: mention.stance_detail ?? null,
  });
  // `title` fallback for keyboard users and occluded popups: the score
  // and the rule in one line.
  const tip =
    explanation.version === "v2"
      ? `${label} ${signed(explanation.score)} — ${explanation.rule}`
      : `${label} — old method: ${FAVORABILITY_TOOLTIP}`;

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
        <Tooltip.Positioner className="z-[100]" sideOffset={4} side="top" align="end">
          <Tooltip.Popup
            className={cn(
              "max-w-md",
              "z-50 border border-border bg-overlay px-3 py-2.5",
              "font-mono text-[11px] leading-relaxed text-text-secondary outline-none",
              "duration-100 data-[instant]:duration-0",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            )}
          >
            {explanation.version === "v2" ? (
              <ScoreExplanationBlock
                label={label}
                explanation={explanation}
                mention={mention}
              />
            ) : (
              <>
                <div className="text-foreground">
                  {label}
                  {mention.stance !== null && ` ${signed(mention.stance)}`}
                </div>
                <div className="mt-1">
                  Scored with the old method: {FAVORABILITY_TOOLTIP.toLowerCase()},
                  not whether other states decided something for or against
                  Ukraine. It changes when the article is re-analysed.
                </div>
                <BasisLine mention={mention} />
                {mention.claim_card && <ClaimCardBlock card={mention.claim_card} />}
              </>
            )}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function ScoreExplanationBlock({
  label,
  explanation: e,
  mention,
}: {
  label: string;
  explanation: Extract<ScoreExplanation, { version: "v2" }>;
  mention: Mention;
}) {
  const coverage = e.coverage ? COVERAGE_TEXT[e.coverage] : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] uppercase tracking-[0.08em] text-foreground">
          {label} {signed(e.score)}
        </span>
        <span className="text-text-tertiary">event score</span>
      </div>

      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1">
        <dt className="text-text-tertiary">What happened</dt>
        <dd className="text-foreground">{e.event ?? "—"}</dd>
        <dt className="text-text-tertiary">Who acted</dt>
        <dd>{ACTOR_TEXT[e.actor]}</dd>
        <dt className="text-text-tertiary">Status</dt>
        <dd>
          {FACT_STATUS_TEXT[e.status].label}
          <span className="text-text-tertiary"> — {FACT_STATUS_TEXT[e.status].meaning}</span>
        </dd>
        <dt className="text-text-tertiary">Effect</dt>
        <dd>{DIRECTION_TEXT[e.direction]}</dd>
        <dt className="text-text-tertiary">Rule</dt>
        <dd className="text-foreground">{e.rule}</dd>
      </dl>

      {e.downgrade && <div className="text-warning">{e.downgrade}</div>}

      {e.evidence && (
        <div>
          <div className="border-l-2 border-strong pl-2 italic">“{e.evidence}”</div>
          <div className={cn("mt-0.5 pl-2.5", e.evidenceFound ? "text-success" : "text-warning")}>
            {e.evidenceFound ? "✓ quote found in the article" : "✗ quote not found in the article"}
          </div>
        </div>
      )}

      {coverage && (
        <div className="border-t border-border pt-2">
          <span className="text-text-tertiary">Coverage (separate): </span>
          <span className="text-foreground">{coverage.label}</span>
          <span className="text-text-tertiary"> — {coverage.meaning}</span>
        </div>
      )}

      {e.reasoning && (
        <div>
          <span className="text-text-tertiary">Model's reasoning: </span>
          {e.reasoning}
        </div>
      )}

      <BasisLine mention={mention} />
    </div>
  );
}

function BasisLine({ mention }: { mention: Mention }) {
  const parts = [
    mention.enrichment_basis === "title_only"
      ? "based on the headline only (paywall)"
      : "based on the article text",
    mention.stance_confidence !== null
      ? `${Math.round(mention.stance_confidence * 100)}% confidence`
      : null,
    mention.framing_label ? `lens: ${mention.framing_label}` : null,
  ].filter(Boolean);
  return <div className="text-[11px] text-text-tertiary">{parts.join(" · ")}</div>;
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
        <div className="flex flex-wrap gap-1 text-[11px] text-text-tertiary">
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
    ? "Analysing…"
    : isEnriched
      ? "Analyse this article again (one AI call)"
      : "Analyse this article (one AI call)";
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
      <span className="font-mono text-[11px] uppercase leading-none tracking-[0.12em] text-text-tertiary">
        {label}
      </span>
      <div className="inline-flex h-8 items-stretch gap-0.5 border border-strong bg-card p-0.5">
        {options.map((opt) => {
          const isActive = opt.key === value;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={cn(
                "px-2.5 font-mono text-[11px] leading-none transition-colors active:translate-y-px",
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

type FilterSection = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
};

/**
 * The technical filters in one menu, one section each (first option of a
 * section = "all", the default). The trigger stays compact: it counts the
 * active choices ("Filters · 1"), names them on hover, and keeps a fixed
 * width so the row never shifts.
 */
function FiltersMenu({ sections }: { sections: FilterSection[] }) {
  const active = sections.filter((s) => s.value !== s.options[0].key);
  const labelOf = (s: FilterSection) =>
    s.options.find((o) => o.key === s.value)?.label ?? s.options[0].label;
  const text = active.length === 0 ? "Filters" : `Filters · ${active.length}`;
  // Hover names the active choices; the menu shows them too.
  const title = active.map((s) => `${s.label}: ${labelOf(s)}`).join(", ") || undefined;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={title}
        style={{ width: `calc(${"Filters · 9".length}ch + 2.25rem)` }}
        className={cn(
          "inline-flex h-8 shrink-0 items-center justify-between gap-1.5 border border-strong px-2 font-mono text-[11px] outline-none transition-colors active:translate-y-px",
          active.length === 0
            ? "text-text-tertiary hover:border-text-tertiary hover:text-foreground"
            : "bg-elevated text-foreground",
        )}
      >
        <span className="truncate">{text}</span>
        <ChevronDown className="size-3 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="min-w-44 border border-border bg-card p-0 text-foreground ring-0 shadow-none"
      >
        {sections.map((s, i) => (
          <div key={s.label}>
            {i > 0 && <DropdownMenuSeparator className="mx-0 my-0 bg-border" />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 pt-2.5 pb-1 font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-text-tertiary">
                {s.label}
              </DropdownMenuLabel>
              {s.options.map((o) => (
                <DropdownMenuItem
                  key={o.key}
                  onClick={() => s.onChange(o.key)}
                  className={cn(
                    "flex cursor-default items-center px-3 py-2 font-mono text-[11px]",
                    "focus:bg-elevated focus:text-foreground",
                    o.key === s.value && "bg-elevated",
                  )}
                >
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </div>
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
        "inline-flex h-8 items-center border border-strong bg-card px-2.5 font-mono text-[11px] transition-colors enabled:active:translate-y-px",
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
