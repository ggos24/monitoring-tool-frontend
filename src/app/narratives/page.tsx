import type { Metadata } from "next";

import { NarrativesPageClient } from "@/components/narratives/narratives-page-client";
import { parseNarrativesPageState } from "@/lib/narrative-view";

export const metadata: Metadata = {
  title: "Narratives · u24-pulse",
  description: "Historical narrative evolution across comparable reports",
};

export default async function NarrativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialState = parseNarrativesPageState(await searchParams);
  return <NarrativesPageClient initialState={initialState} />;
}
