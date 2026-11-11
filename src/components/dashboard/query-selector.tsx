"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Folder, Layers } from "lucide-react";

import { apiClient } from "@/lib/api";
import type { ScopeSelection, Topic, TopicGroup } from "@/lib/types";
import { isCampaignGroupName } from "@/lib/narrative-rules";
import { visibleTopics } from "@/lib/topics";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export const ALL_QUERIES_LABEL = "All queries";

/**
 * Picks what the page looks at: one tracked query (a topic), or
 * "All queries" (the `Campaign` group — union, each article counted once).
 * Other topic groups, if an admin made any, follow under "Groups".
 * The Tier-1 pool is a technical topic and never listed.
 *
 * Used by the Overview and Reports so both speak the same vocabulary.
 */
export function QuerySelector({
  value,
  onChange,
  topicsOnly = false,
  className,
}: {
  value: ScopeSelection | null;
  onChange: (scope: ScopeSelection) => void;
  /** Hide groups (e.g. per-topic scheduled digests). */
  topicsOnly?: boolean;
  className?: string;
}) {
  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: apiClient.topics });
  const groupsQuery = useQuery({
    queryKey: ["topic-groups"],
    queryFn: apiClient.topicGroups,
    enabled: !topicsOnly,
  });

  if (topicsQuery.isLoading) {
    return <Skeleton className={cn("h-11 w-80 bg-elevated", className)} />;
  }
  const topics = visibleTopics(topicsQuery.data);
  const groups = topicsOnly ? [] : (groupsQuery.data ?? []);
  const allGroup = groups.find((g) => isCampaignGroupName(g.name)) ?? null;
  const otherGroups = groups.filter((g) => g !== allGroup);

  const selected = describe(value, topics, groups, allGroup);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex min-w-0 max-w-full items-center gap-3 border border-strong bg-card px-4 py-2.5 text-left outline-none",
          "hover:bg-elevated aria-expanded:bg-elevated",
          className,
        )}
      >
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
          Query
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {selected ?? <span className="text-text-tertiary">Select a query</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-text-secondary" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="min-w-(--anchor-width) max-h-[70vh] overflow-auto border border-border bg-card p-0 text-foreground ring-0 shadow-none"
      >
        {allGroup && (
          <>
            <DropdownMenuGroup>
              <Item
                active={value?.kind === "group" && value.id === allGroup.id}
                onClick={() => onChange({ kind: "group", id: allGroup.id })}
              >
                <Layers className="size-3.5 shrink-0 text-text-secondary" />
                <span className="flex-1 truncate font-medium">{ALL_QUERIES_LABEL}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {allGroup.topic_ids.length} queries
                </span>
              </Item>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-0 bg-elevated" />
          </>
        )}

        <DropdownMenuGroup>
          {/* GroupLabel (Base UI) MUST be inside a Group, else error #31 */}
          <DropdownMenuLabel className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            Queries
          </DropdownMenuLabel>
          {topics.map((t) => (
            <Item
              key={`t-${t.id}`}
              active={value?.kind === "topic" && value.id === t.id}
              onClick={() => onChange({ kind: "topic", id: t.id })}
              title={t.is_active ? t.name : `${t.name} (paused: gets no new articles)`}
            >
              <span
                aria-hidden
                className={cn("size-1.5 shrink-0", t.is_active ? "bg-success" : "bg-strong")}
              />
              <span className="flex-1 truncate">{t.name}</span>
              {!t.is_active && (
                <span className="shrink-0 border border-border px-1 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
                  Paused
                </span>
              )}
            </Item>
          ))}
        </DropdownMenuGroup>

        {otherGroups.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-0 bg-elevated" />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                Groups
              </DropdownMenuLabel>
              {otherGroups.map((g) => (
                <Item
                  key={`g-${g.id}`}
                  active={value?.kind === "group" && value.id === g.id}
                  onClick={() => onChange({ kind: "group", id: g.id })}
                >
                  <Folder className="size-3 shrink-0 text-text-secondary" />
                  <span className="flex-1 truncate">{g.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {g.topic_ids.length} queries
                  </span>
                </Item>
              ))}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function describe(
  value: ScopeSelection | null,
  topics: Topic[],
  groups: TopicGroup[],
  allGroup: TopicGroup | null,
): string | null {
  if (!value) return null;
  if (value.kind === "group") {
    if (allGroup && value.id === allGroup.id) return ALL_QUERIES_LABEL;
    return groups.find((g) => g.id === value.id)?.name ?? null;
  }
  return topics.find((t) => t.id === value.id)?.name ?? null;
}

function Item({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      title={title}
      className={cn(
        "flex cursor-default items-center gap-2 px-3 py-2 text-xs",
        "focus:bg-elevated focus:text-foreground",
        active && "bg-elevated",
      )}
    >
      {children}
    </DropdownMenuItem>
  );
}
