import { Footer } from "@/components/dashboard/footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { ReviewNav } from "@/components/review/review-nav";
import { ReviewPanel } from "@/components/review/review-panel";

export default function ReviewPage() {
  return (
    <>
      <TopBar scope={null} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-5 py-6">
        <header>
          <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-foreground">Review</h1>
          <p className="mt-1 text-xs text-text-tertiary">
            Decide, article by article, whether it belongs to each query. You see
            what the system and the AI auditor decided only after you save.
          </p>
        </header>
        <ReviewNav active="articles" />
        <ReviewPanel />
      </main>
      <Footer />
    </>
  );
}
