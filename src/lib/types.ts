export type TopicType = "brand" | "topic";

export type TopicTerms = {
  core: string[];
  context: string[];
  phrases: string[];
  hashtags: string[];
};

export type TopicProvenance = {
  validated_by_dataforseo: boolean;
  dropped_terms: string[];
  low_confidence_terms: string[];
  discovered_terms: string[];
  created_at: string | null;
};

export type TopicAst = {
  schema_version: number;
  canonical_name: string;
  type: TopicType;
  wikidata_qids: string[];
  languages: string[];
  terms: TopicTerms;
  // CNF anchor groups (backend 2026-07-30 matcher rework). Each inner
  // array is an OR-list; a headline passes the free anchor gate only
  // when EVERY group has at least one word-boundary hit. Also compiled
  // into the GDELT axis query for topic-type topics. Optional because
  // ASTs created before the rework lack the key.
  anchors?: string[][];
  must_co_occur: string[];
  must_not_co_occur: string[];
  gdelt_gkg_themes: string[];
  entity_aliases: string[];
  anchor_text: string;
  provenance: TopicProvenance | null;
};

// Partial AST update payload for PATCH /api/topics/{id}/ast.
// Top-level fields are REPLACED, not deep-merged. schema_version and
// provenance are NOT editable — backend rejects them (extra="forbid").
export type TopicAstPatch = Partial<
  Omit<TopicAst, "schema_version" | "provenance">
>;

export type Topic = {
  id: number;
  name: string;
  query: string;
  queries: Record<string, unknown> | null;
  topic_ast: TopicAst | null;
  is_active: boolean;
  mentions_count: number;
};

// Response shape for POST /api/topics and PATCH /api/topics/{id}/ast.
// Same as Topic but without mentions_count (server doesn't compute it on
// create/edit-ast) and with topic_ast guaranteed non-null + embedding fields.
export type TopicCreateOut = {
  id: number;
  name: string;
  query: string;
  queries: Record<string, unknown> | null;
  topic_ast: TopicAst;
  anchor_embedding_version: string;
  anchor_embedded: boolean;
  is_active: boolean;
};

export type TopicPatch = {
  name?: string;
  query?: string;
  is_active?: boolean;
};

export type StanceLabel = "supportive" | "critical" | "neutral" | "mixed";

// Structured per-mention claim card produced alongside stance when
// `enrichment_settings.claim_card_enabled` is on (or on any manual
// Re-analyze click). NULL on mentions enriched before the flag flipped.
// `schema_version` lets us evolve the shape without losing the link.
export type ClaimCard = {
  schema_version: number;
  headline_claim: string;
  key_claims: string[];
  key_entities: string[];
  stance_evidence: string;
  framing_tags: string[];
};

export type Mention = {
  id: number;
  topic_id: number;
  source_id: number;
  url: string | null;
  title: string | null;
  body: string | null;
  source_domain: string | null;
  language: string | null;
  published_at: string;
  collected_at: string;
  stance: number | null;
  stance_label: StanceLabel | null;
  framing_label: string | null;
  stance_confidence: number | null;
  summary: string | null;
  is_relevant: boolean;
  relevance_method: string | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  claim_card: ClaimCard | null;
};

export type MentionsListResponse = {
  items: Mention[];
  total: number;
  limit: number;
  offset: number;
};

export type TimelinePoint = {
  date: string;
  count: number;
};

export type CountryConfidence = "high" | "medium" | "heuristic";

export type ReachBand = "high" | "mid" | "low";

// Editorial quality bands (Decision 33/34): `unvetted` (trust=2 only) is a
// SUBSET of `suspect` (trust 1-2) — the review queue for domains that have
// no third-party editorial signal yet; `contested` = domains whose CURRENT
// v6 verdict is contested_signals (independent sources disagree).
export type ScoreBand =
  | "trusted"
  | "suspect"
  | "unvetted"
  | "contested"
  | "propaganda";

export type SourceCount = {
  // Canonical publisher identity (Decision 33) — normalized domain, so
  // www./alias variants arrive merged into one row.
  domain: string;
  count: number;
  // Editorial TRUST tier (0-5). Separate axis from reach (Decision 32).
  score: number;
  is_propaganda: boolean;
  country_iso2?: string | null;
  country_confidence?: CountryConfidence | null;
  // REACH axis (Decision 32): audience/authority, independent of trust.
  //   reach_score — continuous 0-100 (sort key)
  //   reach_tier  — 0-5 display badge, parallel to `score`
  //   reach_band  — high/mid/low, for colour coding
  reach_score?: number | null;
  reach_tier?: number | null;
  reach_band?: ReachBand | null;
  // Syndication front-end (yahoo/msn/aol — Decision 33): trust/reach
  // describe the platform, not the original publisher.
  is_aggregator?: boolean;
  // Current v6 verdict is contested_signals (Decision 34) — independent
  // sources disagree; the row gets an editorial-review chip.
  is_contested?: boolean;
};

export type CountryCount = {
  iso2: string | null;
  count: number;
  confidence_breakdown?: Partial<Record<CountryConfidence | "unresolved", number>>;
  top_domains?: string[];
};

export type CountryAttribution = {
  domain: string;
  country_iso2: string | null;
  provider: string | null;
  confidence: string | null;
};

export type DomainScoringSignal = {
  provider:
    | "viginum"
    | "nazk"
    | "euvsdisinfo"
    | "mbfc"
    | "iffy"
    | "imi_whitelist"
    | "ifcn"
    | "wikipedia_rsp"
    | "tranco"
    | "dataforseo_ilr"
    | "dataforseo_etv";
  dimension: "editorial_quality" | "traffic" | "authority";
  flag: string | null;
  raw_value: Record<string, unknown> | null;
  observed_at: string | null;
};

export type DomainScoringDetail = {
  domain: string;
  score: number;
  reason: string;
  is_propaganda: boolean;
  is_low_quality: boolean;
  formula_version: string;
  refreshed_at: string;
  signals: DomainScoringSignal[];
  // REACH axis (Decision 32). null until the DataForSEO refresh + scoring
  // recompute have run for this domain.
  reach_score: number | null;
  reach_tier: number | null;
  reach_band: ReachBand | null;
  reach_authority: number | null;
  reach_traffic: number | null;
  reach_formula_version: string | null;
};

export type JobRun = {
  id: number;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  items_collected: number;
  items_inserted: number;
  error: string | null;
};

export type Overview = {
  total_mentions: number;
  mentions_24h: number;
  mentions_7d: number;
  total_sources: number;
  last_sync_at: string | null;
  next_sync_estimate: string | null;
  schedule_interval_seconds: number;
};

export type RssFeed = {
  id: number;
  url: string;
  name: string;
  publisher_domain: string;
  publisher_domain_normalized: string;
  is_active: boolean;
  last_polled_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  publisher_score: number;
  publisher_is_propaganda: boolean;
};

export type RssFeedCreate = {
  url: string;
  name: string;
};

export type RssFeedPatch = {
  name?: string;
  is_active?: boolean;
};

// Runtime config singleton — GET /api/settings/enrichment (public),
// PATCH /api/settings/enrichment (admin). See docs/FE_ENRICHMENT_API.md §1.
export type EnrichmentSettings = {
  stance_enabled: boolean;
  stance_dry_run: boolean;
  min_source_score: number;
  published_window_hours: number;
  stance_model: string;
  stance_submit_hour: number;
  stance_submit_minute: number;
  stance_retrieve_hour: number;
  stance_retrieve_minute: number;
  digest_enabled: boolean;
  digest_dry_run: boolean;
  summary_model: string;
  digest_submit_hour: number;
  digest_submit_minute: number;
  digest_retrieve_hour: number;
  digest_retrieve_minute: number;
  // PR2 extension — map-reduce report scaffolding.
  claim_card_enabled: boolean;
  claim_card_min_source_score: number;
  digest_min_new_mentions: number;
  report_cluster_size_target: number;
  reduce_model: string;
  // Top-tier gate (Decision 34 follow-up): null = reach floor disabled.
  // Trust 5 always passes; trust 4 needs the domain's current
  // reach_score >= this value. exclude_aggregators drops yahoo/msn/aol.
  min_reach_score: number | null;
  exclude_aggregators: boolean;
  updated_at: string;
  updated_by: string;
};

// Backend rejects unknown fields (extra="forbid") — never send anything
// outside this shape.
export type EnrichmentSettingsPatch = Partial<
  Omit<EnrichmentSettings, "updated_at" | "updated_by">
>;

// Whitelisted filter fields for a segment condition.
export const SEGMENT_FIELDS = [
  "topic_id",
  "country",
  "source_id",
  "source_score",
  "is_propaganda",
  "language",
  "stance_label",
  "framing_label",
] as const;
export type SegmentField = (typeof SEGMENT_FIELDS)[number];

export const SEGMENT_OPS = ["=", "!=", ">=", "<=", "in"] as const;
export type SegmentOp = (typeof SEGMENT_OPS)[number];

export type SegmentValue = string | number | boolean | (string | number)[];

export type SegmentCondition = {
  field: SegmentField;
  op: SegmentOp;
  value: SegmentValue;
};

export type DigestPeriodKind = "day";

export type DigestDefinition = {
  id: number;
  name: string;
  topic_id: number;
  segment: SegmentCondition[];
  period_kind: DigestPeriodKind;
  report_type?: ReportType;
  active: boolean;
  created_at: string;
};

export type DigestDefinitionCreate = {
  name: string;
  topic_id: number;
  segment: SegmentCondition[];
  period_kind?: DigestPeriodKind;
  report_type?: ReportType;
  active?: boolean;
};

export type DigestDefinitionPatch = {
  name?: string;
  segment?: SegmentCondition[];
  report_type?: ReportType;
  active?: boolean;
};

// PR2 — map-reduce report shapes ----------------------------------------

// `narrative` etc. are null while status is pending/running; populated
// on success. `error` non-null when status='failed' OR when status=
// 'success' but the reduce step degraded (partial result).
export type ReportStatus = "pending" | "running" | "success" | "failed";
export type ReportType = "executive" | "intelligence_brief";

// Legacy reports stored a three-value string. V2 stores the complete,
// deterministic within-window calculation and keeps `momentum_tag` as a
// convenience alias. The UI accepts both so old report rows remain readable.
export type LegacyClusterMomentum = "rising" | "flat" | "falling";
export type ClusterMomentumTag = "spiking" | "building" | "steady" | "fading";
export type ClusterMomentum = {
  tag: ClusterMomentumTag;
  slope_ratio: number | null;
  topic_spiking: boolean;
};

export type ReportEvidenceRef = {
  mention_id: number;
  url: string | null;
  domain: string | null;
  title: string | null;
  published_at: string | null;
  // `quote`/verbatim_quote/headline is the shipped backend shape. `text`
  // and the two alternate evidence types are accepted during the additive
  // V2 rollout and make mixed-version API deployments harmless.
  quote?: string | null;
  text?: string | null;
  evidence_type:
    | "verbatim_quote"
    | "headline"
    | "direct_quote"
    | "paraphrase";
  verified_verbatim?: boolean;
};

export type NarrativeLifecycle = {
  status: "new" | "returning";
  direction: "new" | "growing" | "declining" | "stable" | "unknown";
  previous_share: number | null;
  share_delta: number | null;
  match_score: number | null;
};

// Narrative-reports V2: the serialized cluster IS the narrative card.
// LLM-written fields are optional; counts, shares, reach and momentum are
// deterministic. Additive fields remain optional for legacy persisted rows.

export type ReportClusterSummary = {
  cluster_id: number;
  narrative_id?: string | null;
  lifecycle?: NarrativeLifecycle | null;
  name?: string | null;
  handle?: string | null;
  claim?: string | null;
  evidence?: string | null;
  label: string;
  n_mentions: number;
  n_publishers: number;
  share_of_voice?: number | null;
  reach_sov?: number | null;
  prominence?: number | null;
  mean_source_score?: number | null;
  mean_reach_score?: number | null;
  propaganda_share?: number | null;
  daily_series?: { date: string; count: number }[] | null;
  momentum?: ClusterMomentum | LegacyClusterMomentum | null;
  momentum_tag?: ClusterMomentumTag | null;
  countries?: Record<string, number> | null;
  dominant_stance: StanceLabel | null;
  stance_distribution: Record<StanceLabel, number>;
  top_quotes?: string[];
  top_domains?: string[];
  top_titles?: string[];
  members?: number[];
  evidence_refs?: ReportEvidenceRef[];
  decision_status?: "monitor" | "verify" | "investigate" | "escalate";
  decision_reason?: string | null;
  narrative: string | null;
  contested: string | null;
};

export type ReportTierBreakdownEntry = {
  n: number;
  dominant_stance: StanceLabel | null;
  stance_distribution: Record<StanceLabel, number>;
};

// PR1 (per-media & per-country sentiment rollups) entries.
export type PerMediaStanceEntry = {
  domain: string;
  n: number;
  dominant_stance: StanceLabel | null;
  stance_distribution: Record<StanceLabel, number>;
  tier: string;
  country_iso2: string | null;
};

export type StanceByCountryEntry = {
  country_iso2: string | null; // null = unresolved bucket
  n: number;
  n_publishers: number;
  dominant_stance: StanceLabel | null;
  stance_distribution: Record<StanceLabel, number>;
  top_domains: string[];
};

// Coverage-disclosure block (audit honesty pack) — present on reports
// since the 2026-06-12 deploy.
export type ReportBasis = {
  relevant_total: number;
  eligible_total: number;
  enriched_total: number;
  eligible_enriched_total?: number;
  clusterable_total?: number;
  analyzed_in_report?: number;
  clustered_in_report?: number;
  clustered_mentions?: number;
  gate_excluded_total?: number;
  enrichment_gate_min_score?: number;
  enrichment_gate_min_reach_score?: number | null;
  excluded_propaganda?: number;
  excluded_low_tier?: number;
  excluded_aggregators?: number;
  excluded_reach_gate?: number;
  analyzed_outside_current_gate?: number;
  coverage_pct?: number;
  enrichment_coverage_pct?: number;
  analysis_coverage_pct?: number;
  embedding_coverage_pct?: number;
  country_unresolved_pct?: number;
  gate?: {
    min_source_score?: number;
    min_reach_score?: number | null;
    exclude_aggregators?: boolean;
    [key: string]: unknown;
  };
  enrichment_gate?: {
    min_source_score?: number;
    min_reach_score?: number | null;
    exclude_aggregators?: boolean;
    exclude_propaganda?: boolean;
    [key: string]: unknown;
  };
  note?: string;
};

export type ReportDataBasis = ReportBasis & {
  // V2 separates the full topic corpus from the operator-selected slice.
  // These can also be duplicated at aggregates.* during a rolling deploy.
  topic_corpus_basis?: ReportBasis;
  selected_scope_basis?: ReportBasis;
};

export type DepartedNarrative = {
  narrative_id: string;
  name: string;
  previous_share: number | null;
  status: "not_observed";
};

// topic-groups: per-member-topic share of voice (group reports only).
export type PerTopicEntry = {
  topic_id: number;
  topic_name?: string | null;
  n: number;
  share_of_voice: number;
  dominant_stance: StanceLabel | null;
  stance_distribution: Record<StanceLabel, number>;
};

// topic-groups: the report scope. `is_group` true → render group view
// (framing axis + per-topic) instead of single-topic stance.
export type ReportScope = {
  is_group: boolean;
  topic_ids: number[];
  label: string;
};

// Same shape returned in both `report.aggregates` (ad-hoc) and
// `digest_result.aggregates` (scheduled). Later fields optional —
// absent on reports generated before their respective deploys.
export type ReportAggregates = {
  n_mentions: number;
  publisher_weighted_stance: Record<StanceLabel, number>;
  tier_breakdown: Record<string, ReportTierBreakdownEntry>;
  reach_weighted_sov?: {
    overall?: { total_reach?: number };
    by_tier?: Record<string, { reach: number; sov_pct: number }>;
  };
  recency_timeline: { date: string; n: number; dominant_stance: StanceLabel | null }[];
  volume_z_score: number | null;
  sentiment_distribution: Record<StanceLabel, number>;
  per_media_stance?: PerMediaStanceEntry[];
  stance_by_country?: StanceByCountryEntry[];
  top_sources_per_stance?: Record<StanceLabel, { domain: string; n: number }[]>;
  propaganda_share?: number;
  data_basis?: ReportDataBasis;
  topic_corpus_basis?: ReportBasis;
  selected_scope_basis?: ReportBasis;
  departed_narratives?: DepartedNarrative[];
  data_quality?: ReportDataQuality;
  per_topic?: PerTopicEntry[];
  framing_distribution?: Record<string, number>;
  scope?: ReportScope;
  key_themes?: string[];
  representative_outlets?: string[];
  dominant_framing?: string | null;
  notable_divergence?: string | null;
  confidence?: number | null;
  bottom_line?: string | null;
  bluf_bullets?: string[];
  trends?: string | null;
  watchlist?: string[];
  caveats?: string | null;
};

export type ReportDataQuality = {
  version?: string;
  rubric_version?: string;
  grade: "high" | "moderate" | "low";
  score: number;
  reasons: string[];
  metrics?: {
    selected_scope_coverage_pct?: number;
    analyzed_mentions?: number;
    embedding_coverage_pct?: number;
    evidence_coverage_pct?: number;
    country_resolved_pct?: number;
    [key: string]: number | undefined;
  };
  components?: Record<string, number>;
};

export type Report = {
  id: number;
  topic_id: number | null;
  group_id?: number | null;
  topic_ids?: number[] | null;
  report_type?: ReportType;
  params: Record<string, unknown>;
  params_hash: string;
  source_max_collected_at: string | null;
  status: ReportStatus;
  n_mentions: number | null;
  narrative: string | null;
  clusters: ReportClusterSummary[] | null;
  aggregates: ReportAggregates | null;
  model: string | null;
  created_at: string;
  finished_at: string | null;
  requested_by: string | null;
  error: string | null;
  cached?: boolean;
  // Convenience mirrors of aggregates.* on V2 responses. Optional because
  // persisted legacy reports and rolling backend deploys may omit them.
  bottom_line?: string | null;
  bluf_bullets?: string[];
  trends?: string | null;
  watchlist?: string[];
  caveats?: string | null;
};

// Provide exactly one of topic_id | topic_ids | group_id.
export type SegmentReportRequest = {
  topic_id?: number;
  topic_ids?: number[];
  group_id?: number;
  filters: SegmentCondition[];
  date_from?: string | null;
  date_to?: string | null;
  report_type?: ReportType;
};

// Dashboard/report scope param — a single topic or a group. A bare
// number is shorthand for {topic_id} (back-compat with existing callers).
export type ScopeParam = number | { topic_id: number } | { group_id: number };

// Pre-flight scope estimate (POST /api/reports/preview) — what a report
// over the current scope+filters+range would analyze, before running it.
export type ReportPreview = {
  n_mentions: number; // enriched + deduped → analyzed
  n_domains: number; // distinct outlets
  n_relevant: number; // all relevant in scope (context)
  will_run_sync: boolean;
};

// topic-groups: a reusable reporting scope over several topics.
export type TopicGroup = {
  id: number;
  name: string;
  topic_ids: number[];
  created_at: string;
  topic_names: Record<number, string>;
};

export type TopicGroupCreate = {
  name: string;
  topic_ids: number[];
};

export type TopicGroupPatch = {
  name?: string;
  topic_ids?: number[];
};

// Scheduled digest result (extended in PR2 with cluster/aggregate fields).
export type DigestResultDetail = {
  id: number;
  digest_definition_id: number;
  period_start: string;
  n_mentions: number;
  narrative: string;
  key_themes: string[];
  representative_outlets: string[];
  sentiment_distribution: Record<StanceLabel, number>;
  dominant_framing: string | null;
  notable_divergence: string | null;
  confidence: number | null;
  model: string;
  created_at: string;
  clusters: ReportClusterSummary[] | null;
  publisher_weighted_stance: Record<StanceLabel, number> | null;
  tier_breakdown: Record<string, ReportTierBreakdownEntry> | null;
  volume_z_score: number | null;
  recency_timeline: { date: string; n: number; dominant_stance: StanceLabel | null }[] | null;
  // PR1 — full compute_aggregates() blob, uniform with report.aggregates.
  // NULL on rows written before migration a3f9c1e8d2b4.
  aggregates: ReportAggregates | null;
  report_type?: ReportType;
  status?: "success" | "partial" | "failed" | "skipped";
  error?: string | null;
  reason?: string | null;
  provenance?: DigestResultProvenance | null;
  delivery_status?:
    | "not_attempted"
    | "not_configured"
    | "delivered"
    | "failed";
  delivery_error?: string | null;
  delivered_at?: string | null;
};

export type DigestResultProvenance = {
  window?: {
    date_from?: string | null;
    date_to?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

// Operator-visible LLM prompt — GET /api/settings/prompts. Editable
// report prompts can be overridden (PUT) and reset (DELETE) via the
// admin proxy; the enrichment stance prompt is read-only by design.
export type PromptTemplateOut = {
  key: string;
  title: string;
  description: string;
  call_site: string;
  model_setting: string | null;
  editable: boolean;
  is_overridden: boolean;
  text: string;
  default_text: string;
  updated_at: string | null;
  updated_by: string | null;
};

export const FRAMING_LABELS = [
  "pro-ukraine",
  "pro-russia",
  "neutral-factual",
  "anti-western",
  "whataboutism",
  "skeptical",
  "humanitarian",
  "other",
] as const;
export type FramingLabel = (typeof FRAMING_LABELS)[number];
