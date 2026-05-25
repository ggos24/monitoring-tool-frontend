"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export function TopicSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number) => void;
}) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["topics"],
    queryFn: apiClient.topics,
  });

  useEffect(() => {
    if (value === null && data && data.length > 0) {
      onChange(data[0].id);
    }
  }, [data, value, onChange]);

  if (isLoading) {
    return <Skeleton className="h-9 w-64 bg-elevated" />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 border border-border bg-card px-3 py-2 font-mono text-[11px] text-text-tertiary">
        <span>Failed to load topics</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="border border-border bg-elevated px-2 py-0.5 text-text-secondary hover:border-strong hover:text-foreground"
        >
          retry
        </button>
      </div>
    );
  }

  const selected = data.find((t) => t.id === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-2 border border-border bg-card px-3 py-2",
          "font-mono text-xs text-foreground outline-none",
          "hover:border-strong aria-expanded:border-strong",
        )}
      >
        <span className="text-muted-foreground">topic:</span>
        {selected ? (
          <>
            <span className="font-medium">{selected.name}</span>
            <span className="text-muted-foreground">({selected.mentions_count})</span>
          </>
        ) : (
          <span className="text-text-tertiary">Select topic</span>
        )}
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="min-w-(--anchor-width) border border-border bg-card p-0 text-foreground ring-0 shadow-none"
      >
        {data.map((topic) => (
          <DropdownMenuItem
            key={topic.id}
            onClick={() => onChange(topic.id)}
            className={cn(
              "flex cursor-default items-center gap-3 px-3 py-2 font-mono text-xs",
              "focus:bg-elevated focus:text-foreground",
              topic.id === value && "bg-elevated",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5",
                topic.is_active ? "bg-emerald-400" : "bg-strong",
              )}
            />
            <span className="flex-1">{topic.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {topic.mentions_count}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-0 bg-elevated" />
        <DropdownMenuItem
          onClick={() => router.push("/settings/topics/new")}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 font-mono text-xs text-text-secondary focus:bg-elevated focus:text-foreground"
        >
          + Add new topic
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
