"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";

type AiFlag = "stance_enabled" | "digest_enabled";

function useAiFlag(flag: AiFlag): boolean | null {
  const { data } = useQuery({
    queryKey: ["enrichment-settings"],
    queryFn: apiClient.enrichmentSettings,
  });
  return data ? data[flag] : null;
}

// "Off" next to an Advanced section whose AI switch is off, so editors know
// the section does nothing right now. Hidden while loading or on error.
export function AiOffBadge({ flag }: { flag: AiFlag }) {
  const on = useAiFlag(flag);
  if (on !== false) return null;
  return (
    <span title="AI is switched off, so this section does nothing right now.">
      <ComingSoonBadge className="border-warning text-warning">Off</ComingSoonBadge>
    </span>
  );
}

// Advanced page intro. The "AI is switched off" sentence only shows while
// stance analysis really is off.
export function AdvancedIntro() {
  const on = useAiFlag("stance_enabled");
  return (
    <p className="mt-1 text-xs text-text-tertiary">
      Technical settings for reports and AI features.
      {on === false && " AI is switched off, so sections marked Off do nothing right now."}{" "}
      Queries live under Queries.
    </p>
  );
}
