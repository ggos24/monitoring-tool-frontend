"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tooltip } from "@base-ui/react/tooltip";
import { Check, Copy, Plus, Trash2 } from "lucide-react";

import { ApiError, apiClient } from "@/lib/api";
import type { RssFeed, RssFeedPatch } from "@/lib/types";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import { DomainScoreBadge } from "@/components/dashboard/domain-score-badge";
import { cn } from "@/lib/utils";

const SUGGESTIONS: { url: string; name: string }[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: "BBC World" },
  { url: "https://www.theguardian.com/world/rss", name: "Guardian World" },
  { url: "https://feeds.apnews.com/rss/apf-topnews", name: "AP Top News" },
  { url: "https://rss.dw.com/atom/rss-en-all", name: "DW English" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", name: "Al Jazeera" },
];

export function RssFeedsEditor() {
  const [adding, setAdding] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["rss-feeds"],
    queryFn: apiClient.rssFeeds,
  });

  return (
    <section className="bg-zinc-950 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <KickerLabel>RSS feeds</KickerLabel>
          <p className="mt-1 text-xs text-zinc-500">
            Curated publisher feeds polled on the 2h collection cycle. Items
            land in the same mentions stream as other sources.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex cursor-pointer items-center gap-1 border border-zinc-700 bg-zinc-50 px-3 py-1 font-mono text-[11px] text-black hover:bg-zinc-200"
          >
            <Plus className="size-3" />
            New feed
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-4">
          <AddFeedForm
            onCancel={() => setAdding(false)}
            onCreated={() => setAdding(false)}
            showSuggestions={!data || data.length === 0}
          />
        </div>
      )}

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-zinc-900" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
            <span>
              Failed to load feeds
              {error instanceof Error ? ` · ${error.message}` : ""}
            </span>
            <button
              type="button"
              onClick={() => refetch()}
              className="cursor-pointer border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-300 hover:border-zinc-700 hover:text-zinc-50"
            >
              retry
            </button>
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            adding={adding}
            onStartAdd={() => setAdding(true)}
          />
        ) : (
          <ul>
            {data.map((feed) => (
              <FeedRow key={feed.id} feed={feed} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EmptyState({
  adding,
  onStartAdd,
}: {
  adding: boolean;
  onStartAdd: () => void;
}) {
  if (adding) {
    return (
      <div className="font-mono text-[11px] text-zinc-500">
        Fill in the form above to add your first feed.
      </div>
    );
  }
  return (
    <div className="border border-dashed border-zinc-800 p-5">
      <div className="font-mono text-[11px] text-zinc-400">
        No RSS feeds configured. Add curated publisher feeds (BBC, Guardian,
        AP News, etc.) to start monitoring.
      </div>
      <button
        type="button"
        onClick={onStartAdd}
        className="mt-3 inline-flex cursor-pointer items-center gap-1 border border-zinc-700 bg-zinc-50 px-3 py-1 font-mono text-[11px] text-black hover:bg-zinc-200"
      >
        <Plus className="size-3" />
        Add first feed
      </button>
      <div className="mt-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-600">
          Or pick a suggestion
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.url}
              type="button"
              onClick={onStartAdd}
              className="cursor-pointer border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[10px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-50"
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddFeedForm({
  onCancel,
  onCreated,
  showSuggestions,
}: {
  onCancel: () => void;
  onCreated: () => void;
  showSuggestions: boolean;
}) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const urlInvalidClient = useMemo(() => {
    if (!url.trim()) return null;
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "URL must use http:// or https://";
      }
      return null;
    } catch {
      return "Not a valid URL";
    }
  }, [url]);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.createRssFeed({ url: url.trim(), name: name.trim() }),
    onSuccess: (created) => {
      queryClient.setQueryData<RssFeed[] | undefined>(
        ["rss-feeds"],
        (prev) => (prev ? [created, ...prev] : [created]),
      );
      queryClient.invalidateQueries({ queryKey: ["rss-feeds"] });
      setUrl("");
      setName("");
      setErrorMsg(null);
      onCreated();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setErrorMsg("This feed URL already exists.");
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Create failed");
      }
    },
  });

  function submit() {
    setErrorMsg(null);
    if (!url.trim()) {
      setErrorMsg("URL is required.");
      return;
    }
    if (urlInvalidClient) {
      setErrorMsg(urlInvalidClient);
      return;
    }
    if (!name.trim()) {
      setErrorMsg("Name is required.");
      return;
    }
    if (name.trim().length > 255) {
      setErrorMsg("Name must be 255 characters or fewer.");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="border-l-2 border-zinc-800 bg-zinc-950 px-4 py-4">
      <div className="space-y-3">
        <label className="block">
          <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
            Feed URL
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="https://feeds.bbci.co.uk/news/world/rss.xml"
            spellCheck={false}
            autoComplete="off"
            className={cn(
              "mt-1 h-8 w-full border bg-zinc-950 px-2",
              "font-mono text-[11px] text-zinc-50 placeholder:text-zinc-700",
              "outline-none transition-colors",
              urlInvalidClient
                ? "border-red-900 focus:border-red-800"
                : "border-zinc-800 hover:border-zinc-700 focus:border-zinc-700",
            )}
          />
          {urlInvalidClient && (
            <div className="mt-1 font-mono text-[10px] text-red-400">
              {urlInvalidClient}
            </div>
          )}
        </label>

        <label className="block">
          <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
            Display name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="BBC World"
            maxLength={255}
            className={cn(
              "mt-1 h-8 w-full border border-zinc-800 bg-zinc-950 px-2",
              "font-mono text-[11px] text-zinc-50 placeholder:text-zinc-700",
              "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
            )}
          />
        </label>
      </div>

      {showSuggestions && (
        <div className="mt-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-600">
            Suggestions
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.url}
                type="button"
                onClick={() => {
                  setUrl(s.url);
                  setName(s.name);
                  setErrorMsg(null);
                }}
                className="cursor-pointer border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[10px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-50"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 font-mono text-[11px] text-red-400">{errorMsg}</div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer border border-zinc-800 bg-zinc-950 px-3 py-1 font-mono text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={mutation.isPending}
          className={cn(
            "border px-3 py-1 font-mono text-[11px] transition-colors",
            mutation.isPending
              ? "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-700"
              : "cursor-pointer border-zinc-700 bg-zinc-50 text-black hover:bg-zinc-200",
          )}
        >
          {mutation.isPending ? "Adding…" : "Add feed"}
        </button>
      </div>
    </div>
  );
}

type RowMode = "view" | "edit" | "confirm-delete";

function FeedRow({ feed }: { feed: RssFeed }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<RowMode>("view");
  const [draftName, setDraftName] = useState(feed.name);
  const [flash, setFlash] = useState<"saved" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraftName(feed.name);
  }, [feed.id, feed.name]);

  useEffect(() => {
    if (flash === null) return;
    const t = setTimeout(() => setFlash(null), 2000);
    return () => clearTimeout(t);
  }, [flash]);

  const updateMutation = useMutation({
    mutationFn: (patch: RssFeedPatch) => apiClient.updateRssFeed(feed.id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<RssFeed[] | undefined>(["rss-feeds"], (prev) =>
        prev?.map((f) => (f.id === updated.id ? updated : f)),
      );
      setFlash("saved");
      setErrorMsg(null);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 404) {
        queryClient.invalidateQueries({ queryKey: ["rss-feeds"] });
      }
      setErrorMsg(err instanceof Error ? err.message : "Save failed");
      setFlash("error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteRssFeed(feed.id),
    onMutate: () => {
      const previous = queryClient.getQueryData<RssFeed[]>(["rss-feeds"]);
      queryClient.setQueryData<RssFeed[] | undefined>(["rss-feeds"], (prev) =>
        prev?.filter((f) => f.id !== feed.id),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (err instanceof ApiError && err.status === 404) {
        queryClient.invalidateQueries({ queryKey: ["rss-feeds"] });
        return;
      }
      if (ctx?.previous) {
        queryClient.setQueryData(["rss-feeds"], ctx.previous);
      }
      setErrorMsg(err instanceof Error ? err.message : "Delete failed");
      setMode("view");
      setFlash("error");
    },
  });

  function toggleActive() {
    updateMutation.mutate({ is_active: !feed.is_active });
  }

  function saveEdit() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setErrorMsg("Name is required.");
      return;
    }
    if (trimmed.length > 255) {
      setErrorMsg("Name must be 255 characters or fewer.");
      return;
    }
    if (trimmed === feed.name) {
      setMode("view");
      return;
    }
    setErrorMsg(null);
    updateMutation.mutate(
      { name: trimmed },
      { onSuccess: () => setMode("view") },
    );
  }

  function cancelEdit() {
    setDraftName(feed.name);
    setErrorMsg(null);
    setMode("view");
  }

  return (
    <li className="border-b border-zinc-800 last:border-0">
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <StatusBadge feed={feed} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm text-zinc-50">{feed.name}</span>
              <PublisherTrust feed={feed} />
            </div>
            <UrlLine url={feed.url} />
            <FeedMeta feed={feed} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {flash && <StatusFlash kind={flash} />}
          <button
            type="button"
            onClick={toggleActive}
            disabled={updateMutation.isPending}
            className={cn(
              "border px-2 py-1 font-mono text-[11px] transition-colors",
              feed.is_active
                ? "border-emerald-900 bg-emerald-950 text-emerald-400 hover:border-emerald-800"
                : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
              updateMutation.isPending && "opacity-50",
            )}
          >
            {feed.is_active ? "Active" : "Inactive"}
          </button>
          {mode === "view" && (
            <>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="cursor-pointer border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setMode("confirm-delete")}
                aria-label={`Delete ${feed.name}`}
                className="cursor-pointer border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-400 hover:border-red-900 hover:text-red-400"
              >
                <Trash2 className="size-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {mode === "edit" && (
        <div className="mb-3 border-l-2 border-zinc-800 bg-zinc-950 px-4 py-4">
          <label className="block">
            <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
              Display name
            </span>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveEdit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              autoFocus
              maxLength={255}
              className={cn(
                "mt-1 h-8 w-full border border-zinc-800 bg-zinc-950 px-2",
                "font-mono text-[11px] text-zinc-50 placeholder:text-zinc-700",
                "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
              )}
            />
          </label>
          <p className="mt-2 font-mono text-[10px] text-zinc-600">
            URL is not editable. To change the URL, delete this feed and add a
            new one.
          </p>
          {errorMsg && (
            <div className="mt-2 font-mono text-[11px] text-red-400">
              {errorMsg}
            </div>
          )}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="cursor-pointer border border-zinc-800 bg-zinc-950 px-3 py-1 font-mono text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={updateMutation.isPending}
              className={cn(
                "border px-3 py-1 font-mono text-[11px] transition-colors",
                updateMutation.isPending
                  ? "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-700"
                  : "cursor-pointer border-zinc-700 bg-zinc-50 text-black hover:bg-zinc-200",
              )}
            >
              {updateMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {mode === "confirm-delete" && (
        <div className="mb-3 border-l-2 border-red-900 bg-zinc-950 px-4 py-4">
          <div className="font-mono text-[11px] text-zinc-200">
            Delete{" "}
            <span className="text-zinc-50">&ldquo;{feed.name}&rdquo;</span>?
          </div>
          <p className="mt-1 font-mono text-[10px] text-zinc-500">
            Existing mentions from this feed will be kept, but no new items
            will be collected.
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode("view")}
              className="cursor-pointer border border-zinc-800 bg-zinc-950 px-3 py-1 font-mono text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className={cn(
                "border px-3 py-1 font-mono text-[11px] transition-colors",
                deleteMutation.isPending
                  ? "cursor-not-allowed border-red-950 bg-zinc-950 text-zinc-700"
                  : "cursor-pointer border-red-700 bg-red-950 text-red-200 hover:bg-red-900",
              )}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

type Health =
  | { kind: "inactive"; label: string }
  | { kind: "healthy"; label: string }
  | { kind: "degraded"; label: string }
  | { kind: "stalled"; label: string }
  | { kind: "never"; label: string };

function deriveHealth(feed: RssFeed): Health {
  if (!feed.is_active) return { kind: "inactive", label: "Inactive" };
  if (!feed.last_polled_at) return { kind: "never", label: "Never polled" };
  if (feed.consecutive_failures >= 10) {
    return { kind: "stalled", label: "Stalled" };
  }
  if (feed.last_success_at) {
    const ageDays =
      (Date.now() - new Date(feed.last_success_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (ageDays > 7) return { kind: "stalled", label: "Stalled" };
  } else if (feed.consecutive_failures > 0) {
    return { kind: "stalled", label: "Stalled" };
  }
  if (feed.consecutive_failures >= 1) {
    return { kind: "degraded", label: "Degraded" };
  }
  return { kind: "healthy", label: "Healthy" };
}

const HEALTH_DOT: Record<Health["kind"], string> = {
  inactive: "bg-zinc-700",
  healthy: "bg-emerald-400",
  degraded: "bg-amber-400",
  stalled: "bg-red-500",
  never: "border border-zinc-700 bg-transparent",
};

function StatusBadge({ feed }: { feed: RssFeed }) {
  const health = deriveHealth(feed);
  const showsTooltip =
    (health.kind === "degraded" || health.kind === "stalled") &&
    feed.last_error;

  const dot = (
    <span
      aria-hidden
      className={cn("size-2 shrink-0", HEALTH_DOT[health.kind])}
    />
  );

  const content = (
    <span className="flex shrink-0 items-center gap-2">
      {dot}
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.08em]",
          health.kind === "healthy" && "text-emerald-400",
          health.kind === "degraded" && "text-amber-400",
          health.kind === "stalled" && "text-red-400",
          health.kind === "inactive" && "text-zinc-500",
          health.kind === "never" && "text-zinc-500",
        )}
      >
        {health.label}
        {feed.consecutive_failures > 0 && health.kind !== "inactive"
          ? ` · ${feed.consecutive_failures} fail${feed.consecutive_failures === 1 ? "" : "s"}`
          : ""}
      </span>
    </span>
  );

  if (!showsTooltip) return content;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={150} closeDelay={100} render={content} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={4} side="top" align="start">
          <Tooltip.Popup
            className={cn(
              "z-50 max-w-md border border-zinc-800 bg-zinc-950 px-3 py-2",
              "font-mono text-[11px] leading-relaxed text-zinc-300 outline-none",
              "duration-100 data-[instant]:duration-0",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            )}
          >
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              Last error
            </div>
            <div className="break-words whitespace-pre-wrap">
              {feed.last_error}
            </div>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function PublisherTrust({ feed }: { feed: RssFeed }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-[10px] text-zinc-500">
        {feed.publisher_domain_normalized}
      </span>
      <DomainScoreBadge
        score={feed.publisher_score}
        isPropaganda={feed.publisher_is_propaganda}
        domain={feed.publisher_domain_normalized}
      />
    </span>
  );
}

function UrlLine({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard write can fail on insecure contexts — ignore silently
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span
        title={url}
        className="truncate font-mono text-[11px] text-zinc-500"
      >
        {url}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy URL"}
        className="cursor-pointer text-zinc-600 transition-colors hover:text-zinc-300"
      >
        {copied ? (
          <Check className="size-3 text-emerald-400" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </div>
  );
}

function FeedMeta({ feed }: { feed: RssFeed }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-zinc-600">
      <span title={feed.last_polled_at ?? undefined}>
        Polled {relativeTime(feed.last_polled_at)}
      </span>
      <span aria-hidden>·</span>
      <span title={feed.last_success_at ?? undefined}>
        Success {relativeTime(feed.last_success_at)}
      </span>
    </div>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function StatusFlash({ kind }: { kind: "saved" | "error" }) {
  return (
    <span
      className={cn(
        "font-mono text-[11px]",
        kind === "saved" ? "text-emerald-400" : "text-red-400",
      )}
    >
      {kind === "saved" ? "Saved" : "Failed"}
    </span>
  );
}
