import { TRUST_STYLES } from "@/components/dashboard/domain-score-badge";
import type { ReachBand } from "@/lib/types";
import { cn } from "@/lib/utils";

const BAND_LABEL: Record<ReachBand, string> = {
  high: "high reach",
  mid: "mid reach",
  low: "low reach",
};

/**
 * "Colour × digit" COMBO badge — experimental single-informer view for the
 * Top sources panel: COLOUR carries the trust verdict (same red→green ramp
 * as DomainScoreBadge, so propaganda stays red no matter how loud), the
 * DIGIT carries the reach tier (0–5; "—" when unresolved). This does NOT
 * merge the two axes into one number — trust stays the dominant visual
 * channel, reach only says how loud (Decision 32 g2 semantics preserved).
 */
export function TrustReachComboBadge({
  trust,
  isPropaganda,
  reachTier,
  reachScore,
  reachBand,
  className,
}: {
  trust: number;
  isPropaganda?: boolean;
  reachTier: number | null;
  reachScore: number | null;
  reachBand: ReachBand | null;
  className?: string;
}) {
  const clamped =
    Number.isInteger(trust) && trust >= 0 && trust <= 5 ? trust : 2;
  const { bg, fg, label } = TRUST_STYLES[clamped];
  const digit =
    reachTier !== null && Number.isInteger(reachTier)
      ? String(Math.min(5, Math.max(0, reachTier)))
      : "—";
  const reachText =
    reachTier === null
      ? "reach unresolved"
      : `reach ${reachTier}/5${reachBand ? ` (${BAND_LABEL[reachBand]}` : ""}${
          typeof reachScore === "number" ? ` · ${reachScore}/100)` : ")"
        }`;
  const titleText = `Trust ${clamped}/5 · ${label}${
    isPropaganda && clamped !== 0 ? " · propaganda" : ""
  } · ${reachText}`;

  return (
    <span
      title={titleText}
      aria-label={titleText}
      className={cn(
        "inline-flex size-[18px] items-center justify-center font-mono text-[10px] leading-none tabular-nums",
        bg,
        reachTier === null ? "text-muted-foreground" : fg,
        className,
      )}
    >
      {digit}
    </span>
  );
}
