import { Suspense } from "react";

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
            Help us check which articles belong to each query. You read a
            headline, answer one question, and move on.
          </p>
        </header>
        <ReviewNav active="articles" />
        <Suspense fallback={null}>
          <ReviewPanel />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
