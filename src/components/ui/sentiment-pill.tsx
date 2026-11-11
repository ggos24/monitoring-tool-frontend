import { cn } from "@/lib/utils";

type Variant = "positive" | "negative" | "neutral" | "mixed" | "muted";

const styles: Record<Variant, string> = {
  // Emerald — positive stance / supportive
  positive: "bg-success/10 text-success border-success/40",
  // Red — negative stance / critical
  negative: "bg-danger/10 text-danger border-danger/40",
  // Neutral zinc — clearly readable on bg-card
  neutral: "bg-elevated text-text-secondary border-strong",
  // Mixed — neutral grey like the tone panel (a yellow read as a warning);
  // the ↕ glyph tells it apart from Neutral.
  mixed: "bg-elevated text-text-secondary border-strong",
  // Not analysed — plain quiet label, no box: it is the common case, not a state to flag
  muted: "border-transparent bg-transparent px-0 text-text-tertiary",
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
        "px-1.5 py-0.5 text-[11px]",
        styles[variant],
        className,
      )}
    >
      <span aria-hidden className="text-[11px] leading-none">
        {glyphs[variant]}
      </span>
      {children}
    </span>
  );
}
