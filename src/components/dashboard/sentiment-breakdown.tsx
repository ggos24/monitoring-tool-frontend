import { Sparkles } from "lucide-react";

import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";
import { KickerLabel } from "@/components/ui/kicker-label";

const ROWS: { key: string; label: string; pct: number; bar: string; text: string }[] = [
  { key: "positive", label: "positive", pct: 52, bar: "bg-emerald-400", text: "text-emerald-400" },
  { key: "neutral", label: "neutral", pct: 31, bar: "bg-zinc-400", text: "text-zinc-400" },
  { key: "negative", label: "negative", pct: 17, bar: "bg-red-400", text: "text-red-400" },
];

export function SentimentBreakdown() {
  return (
    <div className="relative overflow-hidden bg-black p-5">
      <div className="opacity-50">
        <KickerLabel>Sentiment breakdown</KickerLabel>
        <div className="mt-1 mb-4 text-sm text-zinc-300">Distribution by tone</div>

        <div className="space-y-4">
          {ROWS.map((row) => (
            <div key={row.key}>
              <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
                <span className={row.text}>{row.label}</span>
                <span className="text-zinc-500 tabular-nums">{row.pct}%</span>
              </div>
              <div className="h-1 bg-zinc-800">
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
        className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[3px]"
      >
        <Sparkles className="mb-2 size-4 text-zinc-500" />
        <ComingSoonBadge>Soon</ComingSoonBadge>
        <div className="mt-2 text-xs text-zinc-500">
          LLM-powered sentiment in Phase 2
        </div>
      </div>
    </div>
  );
}
