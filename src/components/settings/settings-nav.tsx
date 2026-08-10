import Link from "next/link";

import { cn } from "@/lib/utils";

type SettingsSection = "general" | "sources";

const SETTINGS_SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  href: string;
}> = [
  { id: "general", label: "General", href: "/settings" },
  { id: "sources", label: "Sources", href: "/sources" },
];

export function SettingsNav({ active }: { active: SettingsSection }) {
  return (
    <nav
      aria-label="Settings sections"
      className="inline-flex border border-border bg-card p-0.5"
    >
      {SETTINGS_SECTIONS.map((section) => {
        const isActive = section.id === active;
        return (
          <Link
            key={section.id}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 font-mono text-xs transition-colors",
              isActive
                ? "bg-elevated text-foreground"
                : "text-text-tertiary hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
