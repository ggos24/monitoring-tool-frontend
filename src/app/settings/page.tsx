import { Footer } from "@/components/dashboard/footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { SchedulerInfo } from "@/components/settings/scheduler-info";
import { TopicsEditor } from "@/components/settings/topics-editor";

export default function SettingsPage() {
  return (
    <>
      <TopBar topicId={null} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-5 py-6">
        <header>
          <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-zinc-50">
            Settings
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Manage tracked topics and view collection schedule.
          </p>
        </header>

        <SchedulerInfo />
        <TopicsEditor />
      </main>
      <Footer />
    </>
  );
}
