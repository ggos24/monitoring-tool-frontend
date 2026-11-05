import { todayUtc, type Period } from "./period";

/**
 * Campaign window, set per deployment (product gives the dates):
 *   NEXT_PUBLIC_CAMPAIGN_START=2026-11-17
 *   NEXT_PUBLIC_CAMPAIGN_END=2027-01-31   (optional; open-ended = today)
 * Unset → the "Campaign" preset is shown disabled.
 */
const START = process.env.NEXT_PUBLIC_CAMPAIGN_START ?? "";
const END = process.env.NEXT_PUBLIC_CAMPAIGN_END ?? "";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function campaignPeriod(): Extract<Period, { kind: "range" }> | null {
  if (!ISO_DAY.test(START)) return null;
  const today = todayUtc();
  if (START > today) return null;
  const end = ISO_DAY.test(END) && END < today ? END : today;
  return { kind: "range", from: START, to: end, campaign: true };
}
