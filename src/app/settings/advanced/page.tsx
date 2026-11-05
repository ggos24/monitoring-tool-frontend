import { Footer } from "@/components/dashboard/footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { DigestsSettings } from "@/components/settings/digests-settings";
import { EnrichmentSettings } from "@/components/settings/enrichment-settings";
import { PromptsEditor } from "@/components/settings/prompts-editor";
import { SettingsNav } from "@/components/settings/settings-nav";
import { TopicGroupsEditor } from "@/components/settings/topic-groups-editor";
import { TopicsEditor } from "@/components/settings/topics-editor";

export default function AdvancedSettingsPage() {
  return (
    <>
      <TopBar scope={null} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-5 py-6">
        <header>
          <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-foreground">
            Advanced
          </h1>
          <p className="mt-1 text-xs text-text-tertiary">
            Matcher definitions, topic groups, the enrichment pipeline, report
            prompts and scheduled digests.
          </p>
        </header>

        <SettingsNav active="advanced" />

        <TopicsEditor advanced />
        <TopicGroupsEditor />
        <EnrichmentSettings />
        <PromptsEditor />
        <DigestsSettings />
      </main>
      <Footer />
    </>
  );
}
