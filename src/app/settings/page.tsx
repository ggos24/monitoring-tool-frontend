import Link from "next/link";

import { Footer } from "@/components/dashboard/footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { EnrichmentSettings } from "@/components/settings/enrichment-settings";
import { PromptsEditor } from "@/components/settings/prompts-editor";
import { SchedulerInfo } from "@/components/settings/scheduler-info";
import { TopicsEditor } from "@/components/settings/topics-editor";

export default function SettingsPage() {
  return (
    <>
      <TopBar topicId={null} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-5 py-6">
        <header>
          <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-xs text-text-tertiary">
            Manage tracked topics, the enrichment pipeline, and report
            prompts. Scheduled reports moved to the{" "}
            <Link
              href="/reports"
              className="text-text-secondary underline-offset-2 hover:text-foreground hover:underline"
            >
              Reports tab
            </Link>
            .
          </p>
        </header>

        <SchedulerInfo />
        <TopicsEditor />
        <EnrichmentSettings />
        <PromptsEditor />
      </main>
      <Footer />
    </>
  );
}
