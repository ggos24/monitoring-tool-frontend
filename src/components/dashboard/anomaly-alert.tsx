import { AlertTriangle, Lock } from "lucide-react";

import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";

export function AnomalyAlert() {
  return (
    <div className="relative overflow-hidden border border-border bg-card px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center border border-amber-800 bg-amber-950">
          <AlertTriangle className="size-3.5 text-warning" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium text-foreground">
              Volume spike detected
            </span>
            <span className="font-mono text-xs tabular-nums text-warning">
              3.2× baseline
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Surge on May 3 driven by 3 events: Politico EU resolution coverage
            (47), BBC fact-check (28), Guardian feature (19). Top driver:{" "}
            <span className="text-foreground underline">
              Politico EU resolution
            </span>
            .
          </p>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]"
      >
        <div className="flex items-center gap-2.5">
          <Lock className="size-3 text-text-tertiary" />
          <span className="text-xs text-text-secondary">Anomaly detection</span>
          <ComingSoonBadge>Soon</ComingSoonBadge>
        </div>
      </div>
    </div>
  );
}
