import type { Topic } from "./types";

/**
 * Narratives the operator can pick. The Tier-1 pool (`role === "pool"`) is a
 * technical topic — the denominator for share-of-coverage — and stays hidden.
 * Older backends don't send `role` yet; then everything is shown.
 */
export function visibleTopics(topics: Topic[] | undefined): Topic[] {
  return (topics ?? []).filter((t) => t.role !== "pool");
}
