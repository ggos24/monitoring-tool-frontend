"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import type { TopicGroup, TopicGroupCreate } from "@/lib/types";

// Topic groups = reusable reporting scopes over several topics. A group
// report unions its members, dedupes shared articles, and clusters into
// cross-topic narratives (Reports tab → scope selector).

export function TopicGroupsEditor() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: apiClient.topics });
  const groupsQuery = useQuery({
    queryKey: ["topic-groups"],
    queryFn: apiClient.topicGroups,
  });
  const topics = topicsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteTopicGroup(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["topic-groups"] }),
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Delete failed."),
  });

  function handleDelete(g: TopicGroup) {
    if (!window.confirm(`Delete group "${g.name}"? Reports already generated are kept.`)) return;
    setError(null);
    deleteMutation.mutate(g.id);
  }

  return (
    <section className="bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <KickerLabel>Topic groups</KickerLabel>
          <p className="mt-1 text-xs text-text-tertiary">
            Reporting scopes over several topics (e.g. &ldquo;Ukraine
            war&rdquo;). A group report unions its members and discovers
            narratives that cut across topics.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setError(null);
          }}
          disabled={topics.length < 2}
          className={cn(
            "flex items-center gap-1 border px-3 py-1 font-mono text-[11px] transition-colors",
            topics.length < 2
              ? "cursor-not-allowed border-border bg-card text-text-tertiary"
              : "cursor-pointer border-strong bg-foreground text-primary-foreground hover:bg-text-secondary",
          )}
          title={topics.length < 2 ? "Need at least 2 topics" : undefined}
        >
          <Plus className="size-3" /> New group
        </button>
      </div>

      {error && (
        <div className="mt-3 border border-red-900 bg-red-950/40 px-3 py-2 font-mono text-[11px] text-red-300">
          {error}
        </div>
      )}

      {showCreate && (
        <GroupForm
          topics={topics}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["topic-groups"] });
          }}
          onError={setError}
        />
      )}

      <div className="mt-4">
        {groupsQuery.isLoading ? (
          <Skeleton className="h-14 w-full bg-elevated" />
        ) : groups.length === 0 ? (
          <div className="font-mono text-[11px] text-text-tertiary">
            No groups yet. Use &ldquo;+ New group&rdquo; to bundle topics
            into a reporting scope.
          </div>
        ) : (
          <ul>
            {groups.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                onDelete={() => handleDelete(g)}
                deleting={deleteMutation.isPending}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function GroupRow({
  group,
  onDelete,
  deleting,
}: {
  group: TopicGroup;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">{group.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            #{group.id} · {group.topic_ids.length} topics
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {group.topic_ids.map((id) => (
            <span
              key={id}
              className="border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-secondary"
            >
              {group.topic_names[id] ?? `topic ${id}`}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        title="Delete group"
        className="cursor-pointer border border-border bg-card p-1.5 text-text-tertiary hover:border-red-900 hover:text-red-400"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

function GroupForm({
  topics,
  onClose,
  onSaved,
  onError,
}: {
  topics: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const createMutation = useMutation({
    mutationFn: (body: TopicGroupCreate) => apiClient.createTopicGroup(body),
    onSuccess: onSaved,
    onError: (err) =>
      onError(err instanceof ApiError ? err.message : "Create failed."),
  });

  function toggle(id: number) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    if (!name.trim()) return onError("Name is required.");
    if (selected.length < 1) return onError("Select at least one topic.");
    createMutation.mutate({ name: name.trim(), topic_ids: selected });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <KickerLabel className="text-text-tertiary">New group</KickerLabel>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer p-1 text-muted-foreground hover:text-text-secondary"
          aria-label="Close"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <label className="mt-3 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
          Name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder='e.g. "Ukraine war"'
          className={cn(
            "mt-1 h-8 w-full border border-border bg-card px-2",
            "font-mono text-[11px] text-foreground placeholder:text-text-tertiary",
            "outline-none transition-colors hover:border-strong focus:border-strong",
          )}
        />
      </label>

      <div className="mt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
          Member topics ({selected.length})
        </span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {topics.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={cn(
                  "border px-2 py-1 font-mono text-[11px] transition-colors",
                  on
                    ? "border-strong bg-foreground text-primary-foreground"
                    : "border-border bg-card text-text-secondary hover:border-strong hover:text-foreground",
                )}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer border border-border bg-card px-3 py-1 font-mono text-[11px] text-text-tertiary hover:border-strong hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className={cn(
            "border px-3 py-1 font-mono text-[11px] transition-colors",
            createMutation.isPending
              ? "cursor-not-allowed border-border bg-card text-text-tertiary"
              : "cursor-pointer border-strong bg-foreground text-primary-foreground hover:bg-text-secondary",
          )}
        >
          {createMutation.isPending ? "Saving…" : "Create group"}
        </button>
      </div>
    </form>
  );
}
