import { cn } from "@/lib/utils";

export function KickerLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-mono text-[10px] uppercase leading-none tracking-[0.1em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
