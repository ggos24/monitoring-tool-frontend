import { cn } from "@/lib/utils";

type Variant = "positive" | "negative" | "neutral" | "mixed" | "muted";

const styles: Record<Variant, string> = {
  positive: "bg-emerald-950 text-emerald-400 border-emerald-900",
  negative: "bg-red-950 text-red-400 border-red-900",
  neutral: "bg-zinc-900 text-zinc-400 border-zinc-800",
  mixed: "bg-amber-950 text-amber-400 border-amber-900",
  muted: "bg-zinc-950 text-zinc-600 border-zinc-900",
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
        "inline-flex items-center border font-mono uppercase leading-none tracking-[0.1em]",
        "px-1.5 py-0.5 text-[9px]",
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
