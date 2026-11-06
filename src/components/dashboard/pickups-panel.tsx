"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type { DateWindow } from "@/lib/period";
import type { PickupSignal } from "@/lib/types";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";

const LIMIT = 50;

const SIGNAL_LABEL: Record<PickupSignal, { text: string; title: string }> = {
  text: { text: "mention", title: "UNITED24 named in the article text" },
  link: { text: "link", title: "Article links to a UNITED24 page or account" },
  both: { text: "mention + link", title: "Named in the text and linked" },
};

/**
 * UNITED24 pickups in Tier-1 media (axis U). Deliberately a list of
 * articles, not a % trend: volumes are small and the two signals (text
 * mention, hyperlink) are reported together with their source (PLAN §9).
 * Campaign-wide — independent of the narrative tab; follows the period.
 */
export function PickupsPanel({ win }: { win: DateWindow }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pickups", win.from, win.to],
    queryFn: () => apiClient.pickups({ date_from: win.from, date_to: win.to, limit: LIMIT }),
    retry: false,
  });
  // Older backends have no /api/pickups — hide the panel rather than error.
  if (error) return null;

  return (
    <div className="bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <KickerLabel>UNITED24 pickups</KickerLabel>
        <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
          {data ? `${data.total.toLocaleString()} in ${win.label}` : win.label}
        </span>
      </div>
      {isLoading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="mt-4 font-mono text-[11px] text-text-tertiary">
          No UNITED24 pickups in selected period.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {data.items.map((p) => (
            <li key={p.url} className="flex items-start justify-between gap-4 py-2.5">
              <div className="min-w-0">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] leading-snug text-foreground underline-offset-2 hover:underline"
                >
                  {p.title ?? p.url}
                </a>
                <div className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                  {p.source_domain} · {p.published_at.slice(0, 10)}
                </div>
              </div>
              <span
                title={SIGNAL_LABEL[p.signal].title}
                className="shrink-0 border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary"
              >
                {SIGNAL_LABEL[p.signal].text}
              </span>
            </li>
          ))}
        </ul>
      )}
      {data && data.total > data.items.length && (
        <div className="mt-2 font-mono text-[11px] text-text-tertiary">
          Showing latest {data.items.length} of {data.total.toLocaleString()}.
        </div>
      )}
    </div>
  );
}
