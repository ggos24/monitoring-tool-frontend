/**
 * Design-system token values exposed to JS consumers (mostly Recharts, which
 * takes string props rather than CSS variables). Keep this file in lockstep
 * with `src/app/globals.css` — these are the same values, just mirrored so
 * components like the timeline chart don't need to read from
 * `getComputedStyle(document.documentElement)`.
 *
 * If you bump a token here, bump it in globals.css too (and vice versa).
 */

export const theme = {
  // Surface ladder
  bgBase: "#0a0a0c",
  bgCard: "#141417",
  bgElevated: "#1c1c20",
  bgOverlay: "#26262b",

  // Borders
  borderDefault: "#2e2e34",
  borderStrong: "#3f3f46",

  // Text tiers
  textPrimary: "#fafafa",
  textSecondary: "#d4d4d8",
  textTertiary: "#a1a1aa",
  textMuted: "#71717a",

  // Semantic accents (mono emerald palette)
  accentSuccess: "#34d399",
  accentWarning: "#fbbf24",
  accentDanger: "#f87171",
} as const;

export type ThemeToken = keyof typeof theme;
