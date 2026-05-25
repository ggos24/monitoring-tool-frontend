import { cn } from "@/lib/utils";

type Variant = "positive" | "negative" | "neutral" | "mixed" | "muted";

const styles: Record<Variant, string> = {
  // Emerald — positive stance / supportive
  positive: "bg-emerald-950 text-emerald-300 border-emerald-800",
  // Red — negative stance / critical
  negative: "bg-red-950 text-red-300 border-red-800",
  // Neutral zinc — clearly readable on bg-card
  neutral: "bg-elevated text-text-secondary border-strong",
  // Amber — mixed framing
  mixed: "bg-amber-950 text-amber-300 border-amber-800",
  // Unscored — visible muted pill (was 1:1 contrast against bg-card; now ~6:1)
  muted: "bg-elevated text-text-tertiary border-strong",
};

/**
 * Leading glyph paired with each variant so meaning isn't color-only.
 * - ▲ supportive   ▼ critical   ─ neutral   ↕ mixed   ○ unscored
 */
const glyphs: Record<Variant, string> = {
  positive: "▲",
  negative: "▼",
  neutral: "─",
  mixed: "↕",
  muted: "○",
};

export function SentimentPill({
  variant,
  children,
  className,
}: {
  variant: Variant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border font-mono uppercase leading-none tracking-[0.1em]",
        "px-1.5 py-0.5 text-[9px]",
        styles[variant],
        className,
      )}
    >
      <span aria-hidden className="text-[10px] leading-none">
        {glyphs[variant]}
      </span>
      {children}
    </span>
  );
}
