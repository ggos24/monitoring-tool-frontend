import type {
  DomainScoringDetail,
  JobRun,
  MentionsListResponse,
  Overview,
  SourceCount,
  TimelinePoint,
  Topic,
  TopicPatch,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

async function api<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${path} failed: ${res.status}`);
  }
  return res.json();
}

type MentionsParams = {
  topic_id: number;
  limit?: number;
  offset?: number;
  search?: string;
  sentiment?: number;
  source_domain?: string;
  date_from?: string;
  date_to?: string;
  source?: "gn" | "gdelt" | "firehose";
  score_band?: "trusted" | "suspect" | "propaganda";
};

export const apiClient = {
  topics: () => api<Topic[]>("/api/topics"),

  updateTopic: (id: number, patch: TopicPatch) =>
    api<Topic>(`/api/topics/${id}`, { method: "PATCH", body: patch }),

  mentions: (params: MentionsParams) => {
    const qs = new URLSearchParams();
    qs.set("topic_id", String(params.topic_id));
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));
    if (params.search) qs.set("search", params.search);
    if (params.sentiment !== undefined) qs.set("sentiment", String(params.sentiment));
    if (params.source_domain) qs.set("source_domain", params.source_domain);
    if (params.date_from) qs.set("date_from", params.date_from);
    if (params.date_to) qs.set("date_to", params.date_to);
    if (params.source) qs.set("source", params.source);
    if (params.score_band) qs.set("score_band", params.score_band);
    return api<MentionsListResponse>(`/api/mentions?${qs}`);
  },

  timeline: (
    topic_id: number,
    days = 7,
    granularity: "hour" | "day" = "day",
  ) =>
    api<TimelinePoint[]>(
      `/api/stats/timeline?topic_id=${topic_id}&days=${days}&granularity=${granularity}`,
    ),

  topSources: (topic_id: number, days = 7, limit = 10) =>
    api<SourceCount[]>(
      `/api/stats/sources?topic_id=${topic_id}&days=${days}&limit=${limit}`,
    ),

  jobRuns: (limit = 20) => api<JobRun[]>(`/api/jobs/runs?limit=${limit}`),

  overview: (topic_id: number) =>
    api<Overview>(`/api/stats/overview?topic_id=${topic_id}`),

  domainScoring: (domain: string) =>
    api<DomainScoringDetail>(
      `/api/scoring/news_domain/${encodeURIComponent(domain)}`,
    ),
};
