import type {
  CountryAttribution,
  CountryCount,
  DigestDefinition,
  DigestDefinitionCreate,
  DigestDefinitionPatch,
  DigestResultDetail,
  DomainScoringDetail,
  EnrichmentSettings,
  EnrichmentSettingsPatch,
  JobRun,
  Mention,
  MentionsListResponse,
  Overview,
  PromptTemplateOut,
  Report,
  ReportPreview,
  RssFeed,
  TopicGroup,
  TopicGroupCreate,
  TopicGroupPatch,
  RssFeedCreate,
  RssFeedPatch,
  SegmentReportRequest,
  SourceCount,
  StanceLabel,
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

async function extractDetail(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown; error?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((d: { loc?: unknown[]; msg?: string }) => {
          const loc = Array.isArray(d.loc) ? d.loc.slice(1).join(".") : "";
          return loc ? `${loc}: ${d.msg ?? ""}` : (d.msg ?? "");
        })
        .filter(Boolean)
        .join("; ");
    }
    if (typeof data.error === "string") return data.error;
  } catch {
    // not JSON
  }
  return fallback;
}

async function api<T>(
  path: string,
  init?: { method?: string; body?: unknown; expectNoContent?: boolean },
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const message = await extractDetail(res, `API ${path} failed: ${res.status}`);
    throw new ApiError(res.status, message);
  }
  if (init?.expectNoContent || res.status === 204) {
    return undefined as T;
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
  stance_label?: StanceLabel;
  enriched?: boolean;
  source_domain?: string;
  date_from?: string;
  date_to?: string;
  source?: "gn" | "gdelt" | "firehose" | "rss";
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
    if (params.stance_label) qs.set("stance_label", params.stance_label);
    if (params.enriched !== undefined) qs.set("enriched", String(params.enriched));
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
    extra?: {
      source?: "gn" | "gdelt" | "firehose" | "rss";
      score_band?: "trusted" | "suspect" | "propaganda";
    },
  ) => {
    const qs = new URLSearchParams({
      topic_id: String(topic_id),
      days: String(days),
      limit: String(limit),
    });
    if (country_iso2) qs.set("country_iso2", country_iso2);
    if (extra?.source) qs.set("source", extra.source);
    if (extra?.score_band) qs.set("score_band", extra.score_band);
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

  enrichMention: (id: number) =>
    localApi<Mention>(`/api/admin/mentions/${id}/enrich`, { method: "POST" }),

  rssFeeds: () => api<RssFeed[]>("/api/rss-feeds"),

  createRssFeed: (body: RssFeedCreate) =>
    api<RssFeed>("/api/rss-feeds", { method: "POST", body }),

  updateRssFeed: (id: number, patch: RssFeedPatch) =>
    api<RssFeed>(`/api/rss-feeds/${id}`, { method: "PATCH", body: patch }),

  deleteRssFeed: (id: number) =>
    api<void>(`/api/rss-feeds/${id}`, {
      method: "DELETE",
      expectNoContent: true,
    }),

  enrichmentSettings: () =>
    api<EnrichmentSettings>("/api/settings/enrichment"),

  updateEnrichmentSettings: (patch: EnrichmentSettingsPatch) =>
    localApi<EnrichmentSettings>("/api/admin/settings/enrichment", {
      method: "PATCH",
      body: patch,
    }),

  digestDefinitions: (params?: { topic_id?: number; active_only?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.topic_id !== undefined) qs.set("topic_id", String(params.topic_id));
    if (params?.active_only !== undefined)
      qs.set("active_only", String(params.active_only));
    const suffix = qs.toString() ? `?${qs}` : "";
    return api<DigestDefinition[]>(`/api/digest-definitions${suffix}`);
  },

  createDigestDefinition: (body: DigestDefinitionCreate) =>
    localApi<DigestDefinition>("/api/admin/digest-definitions", {
      method: "POST",
      body,
    }),

  updateDigestDefinition: (id: number, patch: DigestDefinitionPatch) =>
    localApi<DigestDefinition>(`/api/admin/digest-definitions/${id}`, {
      method: "PATCH",
      body: patch,
    }),

  deleteDigestDefinition: (id: number) =>
    localApi<{ deleted: number }>(`/api/admin/digest-definitions/${id}`, {
      method: "DELETE",
    }),

  // PR2 — map-reduce reports + scheduled digest results.

  generateSegmentReport: (body: SegmentReportRequest) =>
    api<Report>("/api/reports/segment", { method: "POST", body }),

  previewReport: (body: SegmentReportRequest) =>
    api<ReportPreview>("/api/reports/preview", { method: "POST", body }),

  getReport: (id: number) => api<Report>(`/api/reports/${id}`),

  listReports: (
    scope: { topic_id: number } | { group_id: number },
    limit = 20,
  ) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if ("topic_id" in scope) qs.set("topic_id", String(scope.topic_id));
    else qs.set("group_id", String(scope.group_id));
    return api<Report[]>(`/api/reports?${qs}`);
  },

  digestResults: (digest_definition_id: number, limit = 30) =>
    api<DigestResultDetail[]>(
      `/api/digest-definitions/${digest_definition_id}/results?limit=${limit}`,
    ),

  latestDigestResult: (digest_definition_id: number) =>
    api<DigestResultDetail>(
      `/api/digest-definitions/${digest_definition_id}/results/latest`,
    ),

  // Narrative-reports PR — operator-editable report prompts.

  prompts: () => api<PromptTemplateOut[]>("/api/settings/prompts"),

  updatePrompt: (key: string, text: string) =>
    localApi<PromptTemplateOut>(
      `/api/admin/settings/prompts/${encodeURIComponent(key)}`,
      { method: "PUT", body: { text } },
    ),

  resetPrompt: (key: string) =>
    localApi<{ reset: string }>(
      `/api/admin/settings/prompts/${encodeURIComponent(key)}`,
      { method: "DELETE" },
    ),

  // Topic groups — reporting scopes over several topics.

  topicGroups: () => api<TopicGroup[]>("/api/topic-groups"),

  createTopicGroup: (body: TopicGroupCreate) =>
    localApi<TopicGroup>("/api/admin/topic-groups", { method: "POST", body }),

  updateTopicGroup: (id: number, patch: TopicGroupPatch) =>
    localApi<TopicGroup>(`/api/admin/topic-groups/${id}`, {
      method: "PATCH",
      body: patch,
    }),

  deleteTopicGroup: (id: number) =>
    localApi<{ deleted: number }>(`/api/admin/topic-groups/${id}`, {
      method: "DELETE",
    }),
};
