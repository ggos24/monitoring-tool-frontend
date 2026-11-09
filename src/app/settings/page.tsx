import { Footer } from "@/components/dashboard/footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { NarrativesPanel } from "@/components/settings/narratives/narratives-panel";
import { SchedulerInfo } from "@/components/settings/scheduler-info";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsPage() {
  return (
    <>
      <TopBar scope={null} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-5 py-6">
        <header>
          <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-xs text-text-tertiary">
            What each campaign narrative collects and why. Report and AI
            settings live under Advanced.
          </p>
        </header>

        <SettingsNav active="general" />

        <NarrativesPanel />
        <SchedulerInfo />
      </main>
      <Footer />
    </>
  );
}
