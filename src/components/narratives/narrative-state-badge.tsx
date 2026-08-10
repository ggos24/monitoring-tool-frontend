import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleHelp,
  EyeOff,
  RotateCcw,
} from "lucide-react";

import type { NarrativeStateKey } from "@/lib/narrative-view";
import { cn } from "@/lib/utils";

export function NarrativeStateBadge({
  state,
  label,
}: {
  state: NarrativeStateKey;
  label: string;
}) {
  const Icon =
    state === "growing"
      ? ArrowUpRight
      : state === "declining"
        ? ArrowDownRight
        : state === "resurfaced"
          ? RotateCcw
          : state === "not_observed"
            ? EyeOff
            : state === "unknown"
              ? CircleHelp
              : ArrowRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap border border-border px-1.5 py-0.5 font-mono text-[9px]",
        state === "growing" && "text-success",
        state === "declining" && "text-warning",
        state === "newly_observed" && "text-foreground",
        state === "resurfaced" && "text-text-secondary",
        (state === "stable" || state === "unknown") && "text-text-tertiary",
        state === "not_observed" && "text-muted-foreground",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
