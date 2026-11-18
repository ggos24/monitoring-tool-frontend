import { Footer } from "@/components/dashboard/footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { FavorabilityReview } from "@/components/review/favorability-review";
import { ReviewNav } from "@/components/review/review-nav";

export default function FavorabilityReviewPage() {
  return (
    <>
      <TopBar scope={null} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-5 py-6">
        <header>
          <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-foreground">Review</h1>
          <p className="mt-1 text-xs text-text-tertiary">
            Help us check how the system scores articles for Ukraine. You read an
            article, answer four short questions, then see what the model said.
          </p>
        </header>
        <ReviewNav active="favorability" />
        <FavorabilityReview />
      </main>
      <Footer />
    </>
  );
}
