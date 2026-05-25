import { Sparkles } from "lucide-react";

import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";

const EXAMPLES = [
  "How did sentiment shift after the Zelenskyy interview?",
  "Compare our coverage vs Kyiv Independent in Q1",
  "Which journalists wrote about us 3+ times this month?",
];

export function ResearchAssistant() {
  return (
    <div className="relative border border-border bg-card px-6 py-5">
      <div className="absolute top-3 right-3">
        <ComingSoonBadge>Soon</ComingSoonBadge>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex size-9 shrink-0 items-center justify-center border border-border bg-elevated">
          <Sparkles className="size-3.5 text-text-tertiary" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-sm font-medium text-foreground">
            AI Research Assistant
          </h3>
          <p className="mb-4 text-xs leading-relaxed text-text-tertiary">
            Ask questions in natural language, get synthesized reports, detect
            narrative shifts, compare with competitors, surface insights you'd
            miss in raw data.
          </p>

          <ul className="flex max-w-[600px] flex-col gap-2">
            {EXAMPLES.map((q) => (
              <li
                key={q}
                className="flex items-center border border-border bg-background px-3 py-2 font-mono text-xs text-text-tertiary"
              >
                <span aria-hidden className="mr-2 text-text-tertiary">
                  $
                </span>
                <span className="truncate">{q}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
