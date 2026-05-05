import { cn } from "@/lib/utils";

export function ComingSoonBadge({
  children = "Soon",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-zinc-800 bg-zinc-900",
        "px-1.5 py-0.5 font-mono text-[9px] uppercase leading-none tracking-[0.1em] text-zinc-500",
        className,
      )}
    >
      {children}
    </span>
  );
}
