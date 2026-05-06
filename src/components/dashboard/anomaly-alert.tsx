import { AlertTriangle, Lock } from "lucide-react";

import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";

export function AnomalyAlert() {
  return (
    <div className="relative overflow-hidden border border-zinc-800 bg-zinc-950/50 px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center border border-amber-900 bg-amber-950">
          <AlertTriangle className="size-3.5 text-amber-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium text-zinc-50">
              Volume spike detected
            </span>
            <span className="font-mono text-xs tabular-nums text-amber-400">
              3.2× baseline
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Surge on May 3 driven by 3 events: Politico EU resolution coverage
            (47), BBC fact-check (28), Guardian feature (19). Top driver:{" "}
            <span className="text-zinc-200 underline">
              Politico EU resolution
            </span>
            .
          </p>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      >
        <div className="flex items-center gap-2.5">
          <Lock className="size-3 text-zinc-500" />
          <span className="text-xs text-zinc-400">Anomaly detection</span>
          <ComingSoonBadge>Soon</ComingSoonBadge>
        </div>
      </div>
    </div>
  );
}
