export type Brand = {
  id: number;
  name: string;
  is_active: boolean;
  mentions_count: number;
};

export type Mention = {
  id: number;
  brand_id: number;
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
