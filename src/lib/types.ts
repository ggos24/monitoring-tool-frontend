export type Topic = {
  id: number;
  name: string;
  query: string;
  is_active: boolean;
  mentions_count: number;
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

export type SourceCount = {
  domain: string;
  count: number;
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
