import { cn } from "@/lib/utils";

type Style = { bg: string; fg: string; label: string };

const STYLES: Record<number, Style> = {
  0: { bg: "bg-red-700", fg: "text-red-50", label: "Propaganda" },
  1: { bg: "bg-orange-700", fg: "text-orange-50", label: "Low quality" },
  2: { bg: "bg-zinc-800", fg: "text-zinc-400", label: "Unknown" },
  3: { bg: "bg-lime-700", fg: "text-lime-50", label: "Trusted (low)" },
  4: { bg: "bg-green-700", fg: "text-green-50", label: "Trusted (mid)" },
  5: { bg: "bg-emerald-600", fg: "text-emerald-50", label: "Trusted (top)" },
};

export function DomainScoreBadge({
  score,
  isPropaganda,
  className,
}: {
  score: number;
  isPropaganda?: boolean;
  className?: string;
}) {
  const clamped = Number.isInteger(score) && score >= 0 && score <= 5 ? score : 2;
  const { bg, fg, label } = STYLES[clamped];
  const title = isPropaganda && clamped !== 0 ? `${label} · propaganda` : label;

  return (
    <span
      title={`Quality: ${clamped}/5 · ${title}`}
      className={cn(
        "inline-flex size-[18px] items-center justify-center font-mono text-[10px] leading-none tabular-nums",
        bg,
        fg,
        className,
      )}
    >
      {clamped}
    </span>
  );
}
