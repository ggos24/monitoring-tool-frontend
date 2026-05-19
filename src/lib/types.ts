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
  sentiment: number | null;
  sentiment_score: number | null;
  is_relevant: boolean;
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
