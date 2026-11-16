import Link from "next/link";

import { cn } from "@/lib/utils";

type Section = "articles" | "boundaries";

const SECTIONS: Array<{ id: Section; label: string; href: string }> = [
  { id: "articles", label: "Articles", href: "/review" },
  { id: "boundaries", label: "Boundary questions", href: "/review/boundaries" },
];

export function ReviewNav({ active }: { active: Section }) {
  return (
    <nav aria-label="Review sections" className="inline-flex border border-border bg-card p-0.5">
      {SECTIONS.map((s) => (
        <Link
          key={s.id}
          href={s.href}
          aria-current={s.id === active ? "page" : undefined}
          className={cn(
            "px-3 py-1.5 font-mono text-xs transition-colors",
            s.id === active ? "bg-elevated text-foreground" : "text-text-tertiary hover:text-foreground",
          )}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
