"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Folder, Hash } from "lucide-react";

import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export type ReportScopeSel =
  | { kind: "topic"; id: number }
  | { kind: "group"; id: number };

// Combined picker for the Reports tab: groups first (a folder of topics),
// then individual topics. Selecting either drives the report scope —
// a group runs the union report over its members.
export function ScopeSelector({
  value,
  onChange,
}: {
  value: ReportScopeSel | null;
  onChange: (scope: ReportScopeSel) => void;
}) {
  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: apiClient.topics });
  const groupsQuery = useQuery({
    queryKey: ["topic-groups"],
    queryFn: apiClient.topicGroups,
  });

  if (topicsQuery.isLoading) {
    return <Skeleton className="h-9 w-72 bg-elevated" />;
  }
  const topics = topicsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];

  const selectedLabel = (() => {
    if (!value) return null;
    if (value.kind === "group") {
      const g = groups.find((x) => x.id === value.id);
      return g ? { icon: "group" as const, text: g.name, meta: `${g.topic_ids.length} topics` } : null;
    }
    const t = topics.find((x) => x.id === value.id);
    return t ? { icon: "topic" as const, text: t.name, meta: String(t.mentions_count) } : null;
  })();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-2 border border-border bg-card px-3 py-2",
          "font-mono text-xs text-foreground outline-none",
          "hover:border-strong aria-expanded:border-strong",
        )}
      >
        <span className="text-muted-foreground">scope:</span>
        {selectedLabel ? (
          <>
            {selectedLabel.icon === "group" ? (
              <Folder className="size-3 text-text-secondary" />
            ) : (
              <Hash className="size-3 text-text-secondary" />
            )}
            <span className="font-medium">{selectedLabel.text}</span>
            <span className="text-muted-foreground">({selectedLabel.meta})</span>
          </>
        ) : (
          <span className="text-text-tertiary">Select topic or group</span>
        )}
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="min-w-(--anchor-width) max-h-[70vh] overflow-auto border border-border bg-card p-0 text-foreground ring-0 shadow-none"
      >
        {groups.length > 0 && (
          <>
            <DropdownMenuLabel className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
              Groups
            </DropdownMenuLabel>
            {groups.map((g) => (
              <DropdownMenuItem
                key={`g-${g.id}`}
                onClick={() => onChange({ kind: "group", id: g.id })}
                className={cn(
                  "flex cursor-default items-center gap-2 px-3 py-2 font-mono text-xs",
                  "focus:bg-elevated focus:text-foreground",
                  value?.kind === "group" && value.id === g.id && "bg-elevated",
                )}
              >
                <Folder className="size-3 shrink-0 text-text-secondary" />
                <span className="flex-1 truncate">{g.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {g.topic_ids.length}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="my-0 bg-elevated" />
          </>
        )}

        <DropdownMenuLabel className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
          Topics
        </DropdownMenuLabel>
        {topics.map((t) => (
          <DropdownMenuItem
            key={`t-${t.id}`}
            onClick={() => onChange({ kind: "topic", id: t.id })}
            className={cn(
              "flex cursor-default items-center gap-2 px-3 py-2 font-mono text-xs",
              "focus:bg-elevated focus:text-foreground",
              value?.kind === "topic" && value.id === t.id && "bg-elevated",
            )}
          >
            <span
              aria-hidden
              className={cn("size-1.5", t.is_active ? "bg-emerald-400" : "bg-strong")}
            />
            <span className="flex-1 truncate">{t.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {t.mentions_count}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
