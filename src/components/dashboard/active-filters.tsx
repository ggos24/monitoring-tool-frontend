import { cn } from "@/lib/utils";

/**
 * One mono line under a panel title naming the article-list filters that
 * narrow the panel ("Favorable · Google News"), so a filtered chart never
 * reads as the whole picture. Renders nothing when no filter applies.
 */
export function ActiveFilters({
  labels,
  className,
}: {
  labels: string[];
  className?: string;
}) {
  if (labels.length === 0) return null;
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-text-secondary", className)}
      title="Filtered like the article list"
    >
      <span className="size-1.5 bg-success" aria-hidden />
      <span>Filtered: {labels.join(" · ")}</span>
    </div>
  );
}
