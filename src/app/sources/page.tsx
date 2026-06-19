import { Footer } from "@/components/dashboard/footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { DomainCountryOverride } from "@/components/sources/domain-country-override";
import { RssFeedsEditor } from "@/components/sources/rss-feeds-editor";
import { KickerLabel } from "@/components/ui/kicker-label";

export default function SourcesPage() {
  return (
    <>
      <TopBar scope={null} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-5 py-6">
        <header>
          <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-foreground">
            Sources
          </h1>
          <p className="mt-1 text-xs text-text-tertiary">
            Manage source integrations and domain attribution.
          </p>
        </header>

        <DomainCountryOverride />

        <RssFeedsEditor />

        <section className="border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <KickerLabel>Other sources</KickerLabel>
            <span className="border border-border bg-elevated px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-text-tertiary">
              Soon
            </span>
          </div>
          <p className="mt-2 text-xs text-text-tertiary">
            GDELT, Google News and Firehose configuration UI is still coming
            soon. Use the backend admin endpoints for now.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
