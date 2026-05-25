"use client";

import { cn } from "@/lib/utils";

const PERIODS: { label: string; days: number }[] = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export function PeriodToggle({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 border border-border bg-card p-0.5">
      {PERIODS.map((p) => {
        const isActive = p.days === value;
        return (
          <button
            key={p.days}
            type="button"
            onClick={() => onChange(p.days)}
            className={cn(
              "px-2.5 py-1 font-mono text-[11px] leading-none transition-colors",
              isActive
                ? "bg-foreground text-primary-foreground"
                : "bg-transparent text-text-tertiary hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
