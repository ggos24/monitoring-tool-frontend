"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ScheduledReports } from "@/components/reports/scheduled-reports";
import {
  ScopeSelector,
  type ScopeSelection,
} from "@/components/dashboard/scope-selector";

// Scheduled digests (digest_definition rows) — moved off the Reports tab.
// Digests are per-topic, so a narrative picker scopes the list; opening a
// run jumps to the Reports tab, which renders `digest_result_id`.
export function DigestsSettings() {
  const router = useRouter();
  const [scope, setScope] = useState<ScopeSelection | null>(null);

  return (
    <section className="space-y-4 bg-card p-5">
      <ScopeSelector
        value={scope}
        onChange={(next) => next.kind === "topic" && setScope(next)}
      />
      {scope?.kind === "topic" ? (
        <ScheduledReports
          topicId={scope.id}
          selectedResultId={null}
          onSelectResult={(run) =>
            router.push(`/reports?topic_id=${scope.id}&digest_result_id=${run.id}`)
          }
        />
      ) : (
        <p className="font-mono text-[11px] text-text-tertiary">
          Scheduled digests — pick a narrative to manage its nightly reports.
        </p>
      )}
    </section>
  );
}
