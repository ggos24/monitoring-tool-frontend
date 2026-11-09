"use client";

import type { ScopeSelection, Topic, TopicGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Overview scope: one tab per campaign narrative, plus "All narratives"
 * (the `Campaign` topic group — union with each article counted once).
 * The Tier-1 pool is filtered out by the caller.
 */
export function NarrativeTabs({
  narratives,
  allGroup,
  value,
  onChange,
}: {
  narratives: Topic[];
  allGroup: TopicGroup | null;
  value: ScopeSelection | null;
  onChange: (next: ScopeSelection) => void;
}) {
  return (
    <div role="tablist" aria-label="Narratives" className="flex flex-wrap gap-px border border-border bg-border">
      {allGroup && (
        <Tab
          active={value?.kind === "group" && value.id === allGroup.id}
          onClick={() => onChange({ kind: "group", id: allGroup.id })}
        >
          All narratives
        </Tab>
      )}
      {narratives.map((t) => (
        <Tab
          key={t.id}
          active={value?.kind === "topic" && value.id === t.id}
          onClick={() => onChange({ kind: "topic", id: t.id })}
          title={t.is_active ? t.name : `${t.name} (paused: gets no new articles)`}
        >
          <span className="truncate">{t.name}</span>
          {!t.is_active && (
            <span className="ml-1.5 shrink-0 border border-border px-1 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-text-tertiary">
              Paused
            </span>
          )}
        </Tab>
      ))}
    </div>
  );
}

function Tab({
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
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={title}
      className={cn(
        "flex max-w-72 items-center truncate px-3 py-2 font-mono text-xs transition-colors",
        active ? "bg-elevated text-foreground" : "bg-card text-text-tertiary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
