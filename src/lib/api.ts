import type {
  CountryAttribution,
  CountryCount,
  DomainScoringDetail,
  JobRun,
  MentionsListResponse,
  Overview,
  SourceCount,
  TimelinePoint,
  Topic,
  TopicAstPatch,
  TopicCreateOut,
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

// Hits local Next.js Route Handlers that inject the admin key server-side.
// Distinct from `api<T>` because admin paths live on our own origin, not
// the backend at API_URL. Error extraction is richer: FastAPI returns
// `{"detail": "..."}` (or an array for validation errors) and we surface
// it verbatim so 422/400/500 messages reach the operator.
async function localApi<T>(
  path: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  const res = await fetch(path, {
    method: init.method,
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let message = `request failed: ${res.status}`;
    try {
      const data = (await res.json()) as { detail?: unknown; error?: unknown };
      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail
          .map((d: { loc?: unknown[]; msg?: string }) => {
            const loc = Array.isArray(d.loc) ? d.loc.join(".") : "";
            return loc ? `${loc}: ${d.msg ?? ""}` : (d.msg ?? "");
          })
          .filter(Boolean)
          .join("; ");
      } else if (typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // body wasn't JSON — keep generic message
    }
    throw new ApiError(res.status, message);
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
  country_iso2?: string;
};

export const apiClient = {
  topics: () => api<Topic[]>("/api/topics"),

  updateTopic: (id: number, patch: TopicPatch) =>
    api<Topic>(`/api/topics/${id}`, { method: "PATCH", body: patch }),

  createTopic: (phrase: string) =>
    localApi<TopicCreateOut>("/api/admin/topics", {
      method: "POST",
      body: { phrase },
    }),

  updateTopicAst: (id: number, patch: TopicAstPatch) =>
    localApi<TopicCreateOut>(`/api/admin/topics/${id}/ast`, {
      method: "PATCH",
      body: patch,
    }),

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
    if (params.country_iso2) qs.set("country_iso2", params.country_iso2);
    return api<MentionsListResponse>(`/api/mentions?${qs}`);
  },

  timeline: (
    topic_id: number,
    days = 7,
    granularity: "hour" | "day" = "day",
    country_iso2?: string | null,
  ) => {
    const qs = new URLSearchParams({
      topic_id: String(topic_id),
      days: String(days),
      granularity,
    });
    if (country_iso2) qs.set("country_iso2", country_iso2);
    return api<TimelinePoint[]>(`/api/stats/timeline?${qs}`);
  },

  topSources: (
    topic_id: number,
    days = 7,
    limit = 10,
    country_iso2?: string | null,
  ) => {
    const qs = new URLSearchParams({
      topic_id: String(topic_id),
      days: String(days),
      limit: String(limit),
    });
    if (country_iso2) qs.set("country_iso2", country_iso2);
    return api<SourceCount[]>(`/api/stats/sources?${qs}`);
  },

  countries: (topic_id: number, days = 7, limit = 25) =>
    api<CountryCount[]>(
      `/api/stats/countries?topic_id=${topic_id}&days=${days}&limit=${limit}`,
    ),

  jobRuns: (limit = 20) => api<JobRun[]>(`/api/jobs/runs?limit=${limit}`),

  overview: (topic_id: number) =>
    api<Overview>(`/api/stats/overview?topic_id=${topic_id}`),

  domainScoring: (domain: string) =>
    api<DomainScoringDetail>(
      `/api/scoring/news_domain/${encodeURIComponent(domain)}`,
    ),

  domainCountry: (domain: string) =>
    api<CountryAttribution>(
      `/api/scoring/country/${encodeURIComponent(domain)}`,
    ),

  patchDomainCountry: (domain: string, country_iso2: string | null) =>
    localApi<CountryAttribution>(
      `/api/admin/country/${encodeURIComponent(domain)}`,
      { method: "PATCH", body: { country_iso2 } },
    ),

  deleteDomainCountry: (domain: string) =>
    localApi<{ ok: true } | CountryAttribution>(
      `/api/admin/country/${encodeURIComponent(domain)}`,
      { method: "DELETE" },
    ),
};
