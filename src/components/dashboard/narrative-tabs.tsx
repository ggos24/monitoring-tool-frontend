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
          title={t.name}
        >
          {t.name}
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
        "max-w-72 truncate px-3 py-2 font-mono text-xs transition-colors",
        active ? "bg-elevated text-foreground" : "bg-card text-text-tertiary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
