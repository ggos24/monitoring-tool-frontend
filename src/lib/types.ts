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

export type SourceCount = {
  domain: string;
  count: number;
  score: number;
  is_propaganda: boolean;
  country_iso2?: string | null;
  country_confidence?: CountryConfidence | null;
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
  provider: "viginum" | "euvsdisinfo" | "tranco";
  dimension: "editorial_quality" | "traffic";
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
  active: boolean;
  created_at: string;
};

export type DigestDefinitionCreate = {
  name: string;
  topic_id: number;
  segment: SegmentCondition[];
  period_kind?: DigestPeriodKind;
  active?: boolean;
};

export type DigestDefinitionPatch = {
  name?: string;
  segment?: SegmentCondition[];
  active?: boolean;
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
