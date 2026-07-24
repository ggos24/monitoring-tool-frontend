import type { ReachBand } from "@/lib/types";
import { cn } from "@/lib/utils";

// Reach is a DIFFERENT axis from trust — how loud a source is, not how
// trustworthy. So the ramp is deliberately a monochrome blue "intensity"
// scale (dim → bright), NOT the red→green trust semantics. A high-reach
// propaganda outlet must never look green/"good"; it's just loud.
const REACH_STYLES: Record<number, { bg: string; fg: string }> = {
  0: { bg: "bg-strong", fg: "text-text-tertiary" },
  1: { bg: "bg-sky-950", fg: "text-sky-300" },
  2: { bg: "bg-sky-900", fg: "text-sky-200" },
  3: { bg: "bg-sky-800", fg: "text-sky-100" },
  4: { bg: "bg-sky-700", fg: "text-sky-50" },
  5: { bg: "bg-sky-600", fg: "text-sky-50" },
};

const BAND_LABEL: Record<ReachBand, string> = {
  high: "High reach",
  mid: "Mid reach",
  low: "Low reach",
};

/**
 * Audience/authority badge (Decision 32), 0-5 tier parallel to the trust
 * DomainScoreBadge. `tier` is the display bucket; `score` (0-100) and
 * `band` enrich the tooltip. When `tier` is null the domain has no reach
 * signal yet (DataForSEO + Tranco both missing) → dim "—".
 */
export function ReachBadge({
  tier,
  score,
  band,
  className,
}: {
  tier?: number | null;
  score?: number | null;
  band?: ReachBand | null;
  className?: string;
}) {
  const badgeClasses = cn(
    "inline-flex size-[18px] items-center justify-center font-mono text-[10px] leading-none tabular-nums",
    className,
  );

  if (tier === null || tier === undefined) {
    return (
      <span
        title="Reach: not resolved yet"
        aria-label="Reach: not resolved yet"
        className={cn(badgeClasses, "bg-strong text-muted-foreground")}
      >
        —
      </span>
    );
  }

  const clamped = Number.isInteger(tier) && tier >= 0 && tier <= 5 ? tier : 0;
  const { bg, fg } = REACH_STYLES[clamped];
  const bandText = band ? ` · ${BAND_LABEL[band]}` : "";
  const scoreText = typeof score === "number" ? ` · ${score}/100` : "";
  const titleText = `Reach: ${clamped}/5${bandText}${scoreText}`;

  return (
    <span
      title={titleText}
      aria-label={titleText}
      className={cn(badgeClasses, bg, fg)}
    >
      {clamped}
    </span>
  );
}
