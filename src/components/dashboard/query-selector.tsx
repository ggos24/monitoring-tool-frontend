"use client";

import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ChevronDown, Folder, Layers } from "lucide-react";

import { apiClient } from "@/lib/api";
import type { ScopeParam, ScopeSelection, Topic, TopicGroup } from "@/lib/types";
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
import { CONTROL } from "./toolbar";

export const ALL_QUERIES_LABEL = "All queries";

/**
 * Picks what the page looks at: one tracked query (a topic), or
 * "All queries" (the `Campaign` group — union, each article counted once).
 * The queries inside "All queries" are listed right under it; any other
 * query sits under "Not in All queries", other groups under "Groups".
 * With `countWindow`, each row shows its article count for that window,
 * fetched only while the menu is open. The Tier-1 pool is never listed.
 *
 * Used by the Overview and Reports so both speak the same vocabulary.
 */
export function QuerySelector({
  value,
  onChange,
  topicsOnly = false,
  countWindow,
  className,
}: {
  value: ScopeSelection | null;
  onChange: (scope: ScopeSelection) => void;
  /** Hide groups (e.g. per-topic scheduled digests). */
  topicsOnly?: boolean;
  /** Show each row's article count for this window (the period on screen). */
  countWindow?: { from: string; to: string; country: string | null };
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: apiClient.topics });
  const groupsQuery = useQuery({
    queryKey: ["topic-groups"],
    queryFn: apiClient.topicGroups,
    enabled: !topicsOnly,
  });

  const topics = visibleTopics(topicsQuery.data);
  const groups = topicsOnly ? [] : (groupsQuery.data ?? []);
  const allGroup = groups.find((g) => isCampaignGroupName(g.name)) ?? null;
  const otherGroups = groups.filter((g) => g !== allGroup);
  const inAll = allGroup ? topics.filter((t) => allGroup.topic_ids.includes(t.id)) : [];
  const notInAll = allGroup ? topics.filter((t) => !allGroup.topic_ids.includes(t.id)) : topics;

  const selected = describe(value, topics, groups, allGroup);
  const counts = useScopeCounts(
    [
      ...(allGroup ? [{ group_id: allGroup.id } as ScopeParam] : []),
      ...topics.map((t) => t.id as ScopeParam),
      ...otherGroups.map((g) => ({ group_id: g.id }) as ScopeParam),
    ],
    open ? countWindow : undefined,
  );
  const countFor = (scope: ScopeParam) => counts.get(scopeKey(scope));

  if (topicsQuery.isLoading) {
    return <Skeleton className={cn("h-9 w-72 bg-elevated", className)} />;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Query"
        className={cn(CONTROL, "min-w-0 max-w-full justify-between text-left", className)}
      >
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {selected ?? <span className="font-normal text-text-tertiary">Select a query</span>}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        // Wider than the trigger so full names fit; they wrap, never cut.
        className="w-[440px] max-w-[calc(100vw-2rem)] min-w-(--anchor-width) max-h-[70vh] overflow-auto border border-border bg-card p-0 text-foreground ring-0 shadow-none"
      >
        {allGroup && (
          <>
            <DropdownMenuGroup>
              <Item
                active={value?.kind === "group" && value.id === allGroup.id}
                onClick={() => onChange({ kind: "group", id: allGroup.id })}
              >
                <Layers className="size-3.5 shrink-0 text-text-secondary" />
                <span className="flex-1 font-medium">{ALL_QUERIES_LABEL}</span>
                <Count value={countFor({ group_id: allGroup.id })} on={!!countWindow} />
              </Item>
              {/* The queries "All queries" is made of, indented under it. */}
              {inAll.map((t) => (
                <TopicItem
                  key={`t-${t.id}`}
                  topic={t}
                  indent
                  active={value?.kind === "topic" && value.id === t.id}
                  onClick={() => onChange({ kind: "topic", id: t.id })}
                  count={countFor(t.id)}
                  showCount={!!countWindow}
                />
              ))}
            </DropdownMenuGroup>
          </>
        )}

        {notInAll.length > 0 && (
          <>
            {allGroup && <DropdownMenuSeparator className="my-0 bg-elevated" />}
            <DropdownMenuGroup>
              {/* GroupLabel (Base UI) MUST be inside a Group, else error #31 */}
              <DropdownMenuLabel className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
                {allGroup ? "Not in All queries" : "Queries"}
              </DropdownMenuLabel>
              {notInAll.map((t) => (
                <TopicItem
                  key={`t-${t.id}`}
                  topic={t}
                  active={value?.kind === "topic" && value.id === t.id}
                  onClick={() => onChange({ kind: "topic", id: t.id })}
                  count={countFor(t.id)}
                  showCount={!!countWindow}
                />
              ))}
            </DropdownMenuGroup>
          </>
        )}

        {otherGroups.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-0 bg-elevated" />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
                Groups
              </DropdownMenuLabel>
              {otherGroups.map((g) => (
                <Item
                  key={`g-${g.id}`}
                  active={value?.kind === "group" && value.id === g.id}
                  onClick={() => onChange({ kind: "group", id: g.id })}
                >
                  <Folder className="size-3 shrink-0 text-text-secondary" />
                  <span className="flex-1">{g.name}</span>
                  <Count value={countFor({ group_id: g.id })} on={!!countWindow} />
                </Item>
              ))}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopicItem({
  topic: t,
  indent = false,
  active,
  onClick,
  count,
  showCount,
}: {
  topic: Topic;
  indent?: boolean;
  active: boolean;
  onClick: () => void;
  count: number | undefined;
  showCount: boolean;
}) {
  return (
    <Item
      active={active}
      onClick={onClick}
      className={indent ? "pl-8" : undefined}
      title={t.is_active ? undefined : `${t.name} (paused: gets no new articles)`}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0", t.is_active ? "bg-success" : "bg-strong")}
      />
      <span className="flex-1">{t.name}</span>
      {!t.is_active && (
        <span className="shrink-0 border border-border px-1 py-px font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          Paused
        </span>
      )}
      <Count value={count} on={showCount} />
    </Item>
  );
}

/** Right-aligned article count; a dash while it loads. */
function Count({ value, on }: { value: number | undefined; on: boolean }) {
  if (!on) return null;
  return (
    <span
      className="w-12 shrink-0 text-right font-mono text-[11px] text-text-tertiary tabular-nums"
      title="Articles in the period on screen"
    >
      {value === undefined ? "–" : value.toLocaleString()}
    </span>
  );
}

function scopeKey(scope: ScopeParam): string {
  return typeof scope === "number" ? `t${scope}` : "group_id" in scope ? `g${scope.group_id}` : `t${scope.topic_id}`;
}

/** Article totals per scope for a window; one light COUNT request each,
 *  only while `win` is set (the menu is open), cached by react-query. */
function useScopeCounts(
  scopes: ScopeParam[],
  win: { from: string; to: string; country: string | null } | undefined,
): Map<string, number> {
  const results = useQueries({
    queries: scopes.map((scope) => ({
      queryKey: ["scope-count", scopeKey(scope), win?.from, win?.to, win?.country],
      queryFn: () =>
        apiClient.mentions({
          scope,
          limit: 1,
          date_from: win!.from,
          date_to: win!.to,
          country_iso2: win!.country ?? undefined,
        }),
      enabled: !!win,
      staleTime: 60_000,
    })),
  });
  const out = new Map<string, number>();
  results.forEach((r, i) => {
    if (r.data) out.set(scopeKey(scopes[i]), r.data.total);
  });
  return out;
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
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      title={title}
      className={cn(
        "flex cursor-default items-start gap-2 px-3 py-2 text-xs leading-snug",
        "focus:bg-elevated focus:text-foreground",
        "[&>svg]:mt-px [&>span[aria-hidden]]:mt-[5px]",
        active && "bg-elevated",
        className,
      )}
    >
      {children}
    </DropdownMenuItem>
  );
}
