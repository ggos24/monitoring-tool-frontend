"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import type { DateWindow } from "@/lib/period";
import type { PickupSignal } from "@/lib/types";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotFound } from "./campaign-data";

const LIMIT = 50;

const SIGNAL_LABEL: Record<PickupSignal, { text: string; title: string }> = {
  doc_text: { text: "text", title: "UNITED24 named in the article text (GDELT DOC)" },
  gkg_title: { text: "headline", title: "UNITED24 in the headline (GDELT GKG)" },
  gkg_link: { text: "link", title: "Article links to a UNITED24 page or account (GDELT GKG)" },
};

/**
 * UNITED24 pickups in Tier-1 media (axis U). Deliberately a list of
 * articles, not a % trend: volumes are small and each pickup is reported
 * with the signal(s) that found it (PLAN §9). Campaign-wide — independent
 * of the narrative tab; follows the period.
 */
export function PickupsPanel({ win }: { win: DateWindow }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["campaign-pickups", win.from, win.to],
    queryFn: () => apiClient.campaignPickups({ date_from: win.from, date_to: win.to, limit: LIMIT }),
    retry: false,
  });
  // Older backends have no pickups endpoint — hide rather than error.
  if (isNotFound(error)) return null;

  return (
    <div className="bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <KickerLabel>UNITED24 pickups</KickerLabel>
        <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
          {data ? `${data.articles.toLocaleString()} in ${win.label}` : win.label}
        </span>
      </div>
      {error ? (
        <div role="alert" className="mt-4 font-mono text-[11px] text-danger">
          {error instanceof ApiError && error.status === 422
            ? `This period can't be queried for pickups: ${error.message}`
            : `Failed to load pickups: ${(error as Error).message}`}
        </div>
      ) : isLoading ? (
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
            <li key={p.mention_id} className="flex items-start justify-between gap-4 py-2.5">
              <div className="min-w-0">
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] leading-snug text-foreground underline-offset-2 hover:underline"
                  >
                    {p.title ?? p.url}
                  </a>
                ) : (
                  <span className="text-[13px] leading-snug text-foreground">{p.title ?? "(untitled)"}</span>
                )}
                <div className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                  {p.outlet ?? "—"} · {p.published_at.slice(0, 10)}
                </div>
              </div>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {p.signals.map((s) => (
                  <span
                    key={s}
                    title={SIGNAL_LABEL[s]?.title ?? s}
                    className="border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary"
                  >
                    {SIGNAL_LABEL[s]?.text ?? s}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {data?.truncated && (
        <div className="mt-2 font-mono text-[11px] text-text-tertiary">
          Showing latest {data.items.length} of {data.articles.toLocaleString()}.
        </div>
      )}
    </div>
  );
}
