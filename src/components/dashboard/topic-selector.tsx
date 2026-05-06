"use client";

import { useEffect } from "react";
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
    return <Skeleton className="h-9 w-64 bg-zinc-900" />;
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-400">
        <span>Failed to load topics</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-300 hover:border-zinc-700 hover:text-zinc-50"
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
          "inline-flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-3 py-2",
          "font-mono text-xs text-zinc-50 outline-none",
          "hover:border-zinc-700 aria-expanded:border-zinc-700",
        )}
      >
        <span className="text-zinc-600">topic:</span>
        {selected ? (
          <>
            <span className="font-medium">{selected.name}</span>
            <span className="text-zinc-600">({selected.mentions_count})</span>
          </>
        ) : (
          <span className="text-zinc-500">Select topic</span>
        )}
        <ChevronDown className="size-3 text-zinc-600" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="min-w-(--anchor-width) border border-zinc-800 bg-zinc-950 p-0 text-zinc-50 ring-0 shadow-none"
      >
        {data.map((topic) => (
          <DropdownMenuItem
            key={topic.id}
            onClick={() => onChange(topic.id)}
            className={cn(
              "flex cursor-default items-center gap-3 px-3 py-2 font-mono text-xs",
              "focus:bg-zinc-900 focus:text-zinc-50",
              topic.id === value && "bg-zinc-900",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5",
                topic.is_active ? "bg-emerald-400" : "bg-zinc-700",
              )}
            />
            <span className="flex-1">{topic.name}</span>
            <span className="text-zinc-600 tabular-nums">
              {topic.mentions_count}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-0 bg-zinc-900" />
        <DropdownMenuItem
          disabled
          className="flex cursor-default items-center gap-2 px-3 py-2 font-mono text-xs text-zinc-600"
        >
          + Add new topic
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
