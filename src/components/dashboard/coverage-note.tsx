"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";

import { apiClient } from "@/lib/api";
import type { CoverageOutlet } from "@/lib/types";

/**
 * Footnote under the headline figures: they come from the GDELT GKG
 * selection, which sees only part of the Tier-1 network (PLAN §9).
 * Silent when the endpoint is missing, so older backends show nothing.
 */
export function CoverageNote() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["coverage"],
    queryFn: apiClient.coverage,
    staleTime: 60 * 60_000,
    retry: false,
  });
  if (!data) return null;

  return (
    <div className="border border-t-0 border-border bg-card px-5 py-2.5 font-mono text-[11px] text-text-tertiary">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left hover:text-foreground"
      >
        <span aria-hidden>*</span>
        <span>
          Figures cover the {data.visible.length} of {data.network_size} Tier-1
          outlets that GDELT indexes
          {data.selector_version ? ` (selector ${data.selector_version})` : ""}.
          Wire agencies and several paywalled outlets appear only in the live
          Google News panel.
        </span>
        {open ? <ChevronUp className="ml-auto size-3 shrink-0" /> : <ChevronDown className="ml-auto size-3 shrink-0" />}
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 gap-4 pb-1 md:grid-cols-2">
          <OutletList title={`Covered (${data.visible.length})`} outlets={data.visible} />
          <OutletList title={`Not visible to GDELT (${data.not_visible.length})`} outlets={data.not_visible} />
        </div>
      )}
    </div>
  );
}

function OutletList({ title, outlets }: { title: string; outlets: CoverageOutlet[] }) {
  return (
    <div>
      <div className="mb-1.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
      <p className="leading-relaxed text-text-secondary">
        {outlets.map((o) => o.name).join(" · ") || "—"}
      </p>
    </div>
  );
}
