"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  helpText?: string;
  // Soft cap surfaced as a warning when the list hits the backend max.
  maxItems?: number;
};

export function ChipList({
  label,
  items,
  onChange,
  placeholder = "+ add",
  helpText,
  maxItems,
}: Props) {
  const [draft, setDraft] = useState("");

  const atCap = maxItems !== undefined && items.length >= maxItems;

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft("");
      return;
    }
    if (atCap) return;
    const lower = trimmed.toLowerCase();
    if (items.some((it) => it.toLowerCase() === lower)) {
      setDraft("");
      return;
    }
    onChange([...items, trimmed]);
    setDraft("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && items.length > 0) {
      onChange(items.slice(0, -1));
    }
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
          {label}
        </span>
        {atCap && (
          <span className="font-mono text-[10px] text-amber-500">
            max {maxItems} reached
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 border border-border bg-card p-2 transition-colors focus-within:border-strong">
        {items.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="inline-flex items-center gap-1 border border-border bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-foreground"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(idx)}
              aria-label={`Remove ${item}`}
              className="cursor-pointer text-text-tertiary hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          placeholder={atCap ? "" : placeholder}
          disabled={atCap}
          className={cn(
            "min-w-[120px] flex-1 bg-transparent px-1 py-0.5 font-mono text-[11px]",
            "text-foreground placeholder:text-muted-foreground outline-none",
            atCap && "cursor-not-allowed",
          )}
        />
      </div>

      {helpText && (
        <p className="font-mono text-[10px] text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
