"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TopicProvenance } from "@/lib/types";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProvenancePanel({ provenance }: { provenance: TopicProvenance | null }) {
  const [open, setOpen] = useState(false);

  if (!provenance) {
    return (
      <div className="border border-border bg-card p-3">
        <span className="font-mono text-[11px] text-text-tertiary">
          No provenance recorded (legacy or drafter-only topic).
        </span>
      </div>
    );
  }

  const {
    validated_by_dataforseo,
    discovered_terms,
    dropped_terms,
    low_confidence_terms,
    created_at,
  } = provenance;

  return (
    <div className="border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left hover:bg-elevated"
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="size-3 text-text-tertiary" />
          ) : (
            <ChevronRight className="size-3 text-text-tertiary" />
          )}
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            How this was built
          </span>
        </span>
        <span
          className={cn(
            "font-mono text-[11px]",
            validated_by_dataforseo ? "text-emerald-400" : "text-amber-500",
          )}
        >
          {validated_by_dataforseo
            ? "Validated by DataForSEO"
            : "Drafter only — DataForSEO unavailable"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <Group
            label="Discovered by DataForSEO (not from Gemini)"
            items={discovered_terms}
            tone="info"
          />
          <Group
            label="Dropped (volume < 10)"
            items={dropped_terms}
            tone="muted"
          />
          <Group
            label="Low confidence (10 ≤ volume < 100)"
            items={low_confidence_terms}
            tone="muted"
          />
          {created_at && (
            <p className="font-mono text-[10px] text-muted-foreground">
              Created {relativeTime(created_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "info" | "muted";
}) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="font-mono text-[11px] text-text-tertiary">(none)</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((t) => (
            <span
              key={t}
              className={cn(
                "border px-1.5 py-0.5 font-mono text-[11px]",
                tone === "info"
                  ? "border-sky-900 bg-sky-950 text-sky-300"
                  : "border-border bg-elevated text-text-tertiary",
              )}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
