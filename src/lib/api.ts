import type {
  JobRun,
  MentionsListResponse,
  Overview,
  SourceCount,
  TimelinePoint,
  Topic,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}

type MentionsParams = {
  topic_id: number;
  limit?: number;
  offset?: number;
  search?: string;
  sentiment?: number;
  date_from?: string;
  date_to?: string;
};

export const apiClient = {
  topics: () => api<Topic[]>("/api/topics"),

  mentions: (params: MentionsParams) => {
    const qs = new URLSearchParams();
    qs.set("topic_id", String(params.topic_id));
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));
    if (params.search) qs.set("search", params.search);
    if (params.sentiment !== undefined) qs.set("sentiment", String(params.sentiment));
    if (params.date_from) qs.set("date_from", params.date_from);
    if (params.date_to) qs.set("date_to", params.date_to);
    return api<MentionsListResponse>(`/api/mentions?${qs}`);
  },

  timeline: (topic_id: number, days = 7) =>
    api<TimelinePoint[]>(`/api/stats/timeline?topic_id=${topic_id}&days=${days}`),

  topSources: (topic_id: number, days = 7, limit = 10) =>
    api<SourceCount[]>(
      `/api/stats/sources?topic_id=${topic_id}&days=${days}&limit=${limit}`,
    ),

  jobRuns: (limit = 20) => api<JobRun[]>(`/api/jobs/runs?limit=${limit}`),

  overview: (topic_id: number) =>
    api<Overview>(`/api/stats/overview?topic_id=${topic_id}`),
};
