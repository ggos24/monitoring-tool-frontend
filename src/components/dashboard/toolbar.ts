/**
 * One size for every control in the Overview / Reports toolbar (query,
 * period, country, compare, generate report): 36px tall, 12px mono text,
 * the same border and padding — so the row reads as one strip.
 */
export const CONTROL_HEIGHT = "h-9";

export const CONTROL = [
  "inline-flex h-9 shrink-0 items-center gap-2 border border-strong bg-card px-3",
  "font-mono text-xs text-text-secondary outline-none transition-colors",
  "hover:border-text-tertiary hover:text-foreground aria-expanded:border-text-tertiary",
  "active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40",
].join(" ");
