import { cn } from "@/lib/utils";

export function KickerLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-mono text-[11px] uppercase leading-none tracking-[0.1em] text-text-tertiary",
        className,
      )}
    >
      {children}
    </h2>
  );
}
