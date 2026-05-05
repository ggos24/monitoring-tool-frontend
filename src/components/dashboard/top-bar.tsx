import { cn } from "@/lib/utils";

type NavItem = { label: string; active?: boolean; info?: boolean };

const NAV: NavItem[] = [
  { label: "Overview", active: true },
  { label: "Mentions" },
  { label: "Sources" },
  { label: "Insights", info: true },
  { label: "Settings" },
];

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-zinc-900 bg-black/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <div className="size-2 bg-emerald-400" aria-hidden />
          <span className="font-mono text-sm text-zinc-50">u24-pulse</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.label}
              href="#"
              className={cn(
                "cursor-default px-3 py-1.5 font-mono text-xs transition-colors",
                item.active
                  ? "bg-zinc-900 text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-300",
              )}
            >
              {item.label}
              {item.info && <span className="ml-1 text-zinc-700">ⓘ</span>}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-600">
          <span
            className="inline-block size-1.5 animate-pulse bg-emerald-400"
            aria-hidden
          />
          <span className="hidden sm:inline">Live · last sync 2m ago</span>
        </div>
      </div>
    </header>
  );
}
