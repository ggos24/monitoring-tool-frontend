import { Sparkles } from "lucide-react";

import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";
import { KickerLabel } from "@/components/ui/kicker-label";

const ROWS: { key: string; label: string; pct: number; bar: string; text: string }[] = [
  { key: "positive", label: "positive", pct: 52, bar: "bg-emerald-400", text: "text-emerald-400" },
  { key: "neutral", label: "neutral", pct: 31, bar: "bg-text-tertiary", text: "text-text-tertiary" },
  { key: "negative", label: "negative", pct: 17, bar: "bg-red-400", text: "text-red-400" },
];

export function SentimentBreakdown() {
  return (
    <div className="relative overflow-hidden bg-background p-5">
      <div className="opacity-50">
        <KickerLabel>Sentiment breakdown</KickerLabel>
        <div className="mt-1 mb-4 text-sm text-text-secondary">Distribution by tone</div>

        <div className="space-y-4">
          {ROWS.map((row) => (
            <div key={row.key}>
              <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
                <span className={row.text}>{row.label}</span>
                <span className="text-text-tertiary tabular-nums">{row.pct}%</span>
              </div>
              <div className="h-1 bg-strong">
                <div
                  className={`h-full ${row.bar}`}
                  style={{ width: `${row.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden
        className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[3px]"
      >
        <Sparkles className="mb-2 size-4 text-text-tertiary" />
        <ComingSoonBadge>Soon</ComingSoonBadge>
        <div className="mt-2 text-xs text-text-tertiary">
          LLM-powered sentiment in Phase 2
        </div>
      </div>
    </div>
  );
}
