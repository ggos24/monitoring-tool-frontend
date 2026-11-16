import { Footer } from "@/components/dashboard/footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { BoundaryPanel } from "@/components/review/boundary-panel";
import { ReviewNav } from "@/components/review/review-nav";

export default function BoundaryQuestionsPage() {
  return (
    <>
      <TopBar scope={null} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-5 py-6">
        <header>
          <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-foreground">Review</h1>
          <p className="mt-1 text-xs text-text-tertiary">
            Help us check which articles belong to each query.
          </p>
        </header>
        <ReviewNav active="boundaries" />
        <BoundaryPanel />
      </main>
      <Footer />
    </>
  );
}
