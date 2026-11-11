"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { formatDayLabel } from "@/lib/period";
import type { CoverageLevel, CoverageOutlet } from "@/lib/types";
import { useCampaignCoverage } from "./campaign-data";

const GROUPS: { level: CoverageLevel; label: string }[] = [
  { level: "visible", label: "Fully covered" },
  { level: "sparse", label: "Partially covered" },
  { level: "invisible", label: "Not visible to GDELT" },
];

/**
 * Footnote under the headline figures: they come from the GDELT GKG
 * selection, which sees only part of the Tier-1 network (PLAN §9).
 * Hidden on 404 (older backend) and when the backend has no visibility
 * file (`available: false`).
 */
export function CoverageNote() {
  const [open, setOpen] = useState(false);
  const { data } = useCampaignCoverage();
  if (!data || !data.available) return null;

  const full = data.counts.visible ?? 0;
  const sparse = data.counts.sparse ?? 0;
  const total = full + sparse + (data.counts.invisible ?? 0);
  const measured =
    data.measured_from && data.measured_to
      ? `Visibility measured ${formatDayLabel(data.measured_from)} – ${formatDayLabel(data.measured_to)}`
      : undefined;

  return (
    <div className="border border-t-0 border-border bg-card px-5 py-2.5 font-mono text-[11px] text-text-tertiary">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        // Selector version is an opaque build id (e.g. "gkg-v1+n3.f627…"):
        // useful for audits, too long for the sentence itself.
        title={[measured, data.selector_version ? `GKG selector: ${data.selector_version}` : null].filter(Boolean).join(" · ") || undefined}
        className="flex w-full items-center gap-1.5 text-left hover:text-foreground"
      >
        <span aria-hidden>*</span>
        <span>
          Figures include {full} of our {total} Tier-1 media fully and {sparse} partially;
          the other {total - full - sparse} are not visible to GDELT yet. Show list
        </span>
        {open ? <ChevronUp className="ml-auto size-3 shrink-0" /> : <ChevronDown className="ml-auto size-3 shrink-0" />}
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 gap-4 pb-1 md:grid-cols-3">
          {GROUPS.map((g) => (
            <OutletList
              key={g.level}
              title={`${g.label} (${data.counts[g.level] ?? 0})`}
              outlets={data.outlets[g.level] ?? []}
            />
          ))}
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
        {outlets.map((o) => o.name ?? o.domain).filter(Boolean).join(" · ") || "—"}
      </p>
    </div>
  );
}
