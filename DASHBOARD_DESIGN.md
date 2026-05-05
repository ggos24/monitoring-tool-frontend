# u24-pulse Dashboard — Design Specification

This document is the **source of truth** for the Next.js frontend look-and-feel. Implement components to match this spec; if reality conflicts with the spec, update the spec first, then sync the code.

## Visual identity

- **Aesthetic:** Vercel/Linear-inspired. Black background, sharp rectangular corners, monospace accents, information-dense, minimal decoration.
- **No rounded corners anywhere.** All borders, buttons, cards, inputs, badges — sharp 0px radius. This is intentional and non-negotiable.
- **No gradients, no shadows, no glow effects.** Flat surfaces only.
- **Tone:** terminal/devtools. Technical but readable. Confident, not playful.

## Color tokens

Dark theme is the default and only theme for MVP.

```
--bg-base:         #000000   (page background)
--bg-elevated:     #09090b   (cards, inputs background — barely visible against bg-base)
--bg-hover:        rgba(24,24,27,0.5)   (hover state on rows)
--bg-overlay:      rgba(0,0,0,0.4)      (coming-soon blur overlay)
--bg-muted:        #18181b   (subtle backgrounds, separator lines used as dividers)

--border:          #18181b   (default border, almost invisible)
--border-strong:   #27272a   (input borders, button borders, on-hover)
--border-hover:    #3f3f46   (focus state)

--text-primary:    #fafafa   (main text, KPI numbers, mention titles)
--text-secondary:  #d4d4d8   (subtitles, less critical)
--text-tertiary:   #a1a1aa   (descriptions, secondary metadata)
--text-muted:      #71717a   (labels)
--text-faint:      #52525b   (timestamps, mono labels, hints)
--text-disabled:   #3f3f46   (placeholders, disabled states)

--accent-success:  #34d399   (positive trends, "live" indicator, line chart, positive sentiment)
--accent-warning:  #fbbf24   (volume spike, anomaly, warning)
--accent-danger:   #f87171   (negative sentiment, errors)
--accent-neutral:  #a1a1aa   (neutral sentiment)
```

Sentiment pill colors (border + bg + text):
- positive: bg `#022c22`, text `#34d399`, border `#064e3b`
- negative: bg `#450a0a`, text `#f87171`, border `#7f1d1d`
- neutral:  bg `#18181b`, text `#a1a1aa`, border `#27272a`

## Typography

- **Sans-serif:** Inter or system font stack — used for titles, body, KPI numbers
- **Monospace:** "SF Mono", "Geist Mono", monospace — used for: labels, timestamps, domain names, period buttons, KPI changes (▲ 12.4%)
- **No 600/700 weights.** Only 400 (regular) and 500 (medium for emphasis).
- **Sentence case everywhere.** Never Title Case, never ALL CAPS. Exception: monospace labels in `UPPERCASE` with `letter-spacing: 0.1em` for kicker-style headers ("TOTAL MENTIONS", "MENTIONS OVER TIME").
- KPI numbers: 26px, weight 500, `font-variant-numeric: tabular-nums`, `letter-spacing: -0.02em`.
- Mention titles: 13px, weight 400, color text-primary.
- Card kicker labels: 10px monospace, uppercase, letter-spacing 0.1em, color text-faint.
- Card subtitles (under kicker): 13px, color text-tertiary.

## Layout grid

- Max content width: 1440px, centered.
- Padding: 20px on desktop, 16px on mobile.
- All grids use 1px gaps between cards (achieved via `display:grid; gap:1px; background:var(--border)`). The 1px "gap" is actually the divider color showing through.
- Cards have NO border individually — the grid background simulates dividers.

## Components inventory

The dashboard composes from these primitives (build them as reusable React components):

### 1. TopBar
- Height 56px, sticky at top with backdrop blur on scroll.
- Left: logo dot (8×8 emerald square) + "u24-pulse" wordmark in monospace.
- Center: nav links (Overview, Mentions, Sources, Insights ⓘ, Settings). Active link has `bg-muted` background, others are text-faint with hover to text-secondary.
- Right: live status indicator: pulsing 6×6 emerald square + "Live · last sync 2m ago" in monospace text-faint.
- Mobile (<780px): hide nav, keep logo + status.

### 2. BrandSelector (dropdown)
- Trigger button: bg-elevated, border-strong, padding 8/12, monospace prefix "brand:" (text-faint), brand name (medium weight), count in parens (text-faint mono), chevron-down icon.
- On click: dropdown panel below, same width minimum, list of brands with status dot (emerald if active, neutral if disabled), name, count right-aligned in mono.
- Footer row of dropdown: "+ Add new brand" — opens modal (out of scope for MVP, just a visual cue).

### 3. PeriodToggle
- Inline pill group: 24h / 7d / 30d / 90d.
- Container: bg-elevated, border-strong, 2px padding.
- Active button: `#fafafa` background, black text. Inactive: transparent bg, text-faint.
- Monospace, 11px.

### 4. KpiCard
- Single card in a 4-column grid. Each card:
  - Kicker label (mono, 10px, uppercase, letter-spacing 0.1em, text-faint)
  - Big number (26px, weight 500, tabular nums)
  - Trend indicator on the right of the number row: green ▲ for positive change, red ▼ for negative, faint "stable" for no change. Format: `▲ 12.4%`. Mono 11px.
  - Period subtitle (text-disabled, 11px): "vs last 7d", "last 7 days", "new this week", "monitored"
- Mobile: collapse to 2×2 grid.

### 5. ChartCard / LineChart
- Card holds: kicker label, subtitle, and chart canvas.
- Chart: line chart with subtle area fill (8% opacity).
- Line color: emerald (#34d399), stroke-width 1.5, with circular dots at each data point (3px radius, 5px on hover).
- Grid: only horizontal lines, color border-default, no vertical grid.
- Axes: 10px monospace labels, text-faint.
- Tooltip: bg-elevated, border-strong, no border-radius, monospace 11px.
- Library: Recharts (preferred) or Chart.js — whichever Claude Code finds cleaner with TypeScript.

### 6. SentimentBreakdown (coming-soon variant)
- Card with kicker + subtitle.
- Below: 3 horizontal bar rows (positive/neutral/negative) with %.
- The whole card content is at 50% opacity, with a blur overlay (`backdrop-filter: blur(3px); background: bg-overlay`) showing a sparkles icon, "soon" badge, and message "LLM-powered sentiment in Phase 2".
- Behind blur: actual content rendered (so when we eventually flip Phase 2, removing the overlay shows real bars).

### 7. AnomalyAlert (coming-soon variant)
- Wide card, border-default, padding 16/20.
- Left: 32×32 amber-tinted icon container (warning triangle).
- Right: title + spike multiplier in amber + description paragraph.
- Same blur+badge overlay pattern as SentimentBreakdown.
- Visible state pre-blur: realistic anomaly text (so when Phase 3 enables it, content is already there).

### 8. SourcesList
- Sidebar-style card.
- Each source row: domain name (mono, text-secondary) + count (text-faint, tabular).
- Below text: 3px-tall bar showing relative count (filled portion = count / max_count percentage).
- Hover: bar fill turns text-primary, base bar turns border-strong.
- Footer: "View all 38 sources ↗" — mono, text-faint, opens Sources tab on click. **Use sendPrompt to open natural-language search later.**

### 9. MentionsList
- Filter bar at top:
  - Search input: bg-elevated, border-strong, magnifying glass icon, monospace 11px, placeholder "Search title or body..."
  - Sentiment filter pill group: All / + / ~ / − (mono, same styling as PeriodToggle)
- Mention rows (8 visible per page):
  - Top metadata row: domain (mono, text-faint) · timestamp (mono, text-faint) · sentiment pill on the right
  - Title (13px, text-primary)
  - Preview line (11px, text-faint, truncated to 1 line with ellipsis)
  - On hover: bg-hover background
  - Click: opens external URL in new tab (window.open(url) — Next.js will use proper Link to mention detail page)
- Bottom: pagination — "Showing 1–8 of 142" (mono text-faint) + prev/next buttons (mono 11px, border-strong, prev disabled at first page).

### 10. SentimentPill (atom)
- Used inside MentionRow.
- Padding 2/6, border 0.5px, monospace 9px uppercase letter-spacing 0.1em.
- Three variants — positive/negative/neutral — with the colors specified in `Color tokens` above.

### 11. ComingSoonBadge (atom)
- Mono 9px, uppercase, letter-spacing 0.1em, text-muted color.
- Background bg-muted, border-strong, padding 2/6.
- Text content: just "SOON" (or longer like "COMING SOON" if context demands).

### 12. ResearchAssistantTeaser (coming-soon)
- Wide card at the bottom of overview.
- Layout: 36×36 icon container (sparkles) + title "AI Research Assistant" + paragraph + 3 example query rows.
- Example query rows: bg-base, border-default, monospace 11px, with "$" prefix in text-disabled. Look like terminal prompts.
- "soon" badge in top-right corner of the card.
- Examples to use:
  - "How did sentiment shift after the Zelenskyy interview?"
  - "Compare our coverage vs Kyiv Independent in Q1"
  - "Which journalists wrote about us 3+ times this month?"

### 13. Footer
- Centered, border-top, 18px vertical padding.
- Mono 11px, text-disabled.
- Items separated by " · ": version, sources, "Next sync in 23m", "API docs ↗".

## Page composition (Overview = `/`)

Vertical stack from top to bottom:

1. TopBar (sticky)
2. Padding container (max-width 1440px, padding 20px)
3. Row: BrandSelector (left) + PeriodToggle (right)
4. KpiCards grid (4 columns desktop, 2×2 mobile)
5. AnomalyAlert (coming-soon)
6. Two-column row: ChartCard `Mentions over time` (2/3 width) + SentimentBreakdown coming-soon (1/3 width)
7. Two-column row: SourcesList (1/3 width) + MentionsList (2/3 width)
8. ResearchAssistantTeaser (full width, coming-soon)
9. Footer

## Responsive behavior

- 1024px+: full layout as described.
- 780px–1024px: nav still visible, KPI grid stays 4-up, content rows collapse to 1-column stacks.
- <780px: hide nav links in TopBar (keep logo + status), KPI 2×2, all rows full-width single column. Mention preview line hidden (just title + meta).

## Interactions

- **Brand dropdown:** click trigger toggles, click outside closes, ESC closes. Selecting a brand updates dashboard data (refetches).
- **Period toggle:** clicking refetches data.
- **Search:** debounced 300ms, then refetches `/api/mentions?search=...`.
- **Sentiment filter:** instant — refetches with `sentiment` param.
- **Mention click:** opens `mention.url` in new tab. (Later: opens detail panel.)
- **"View all sources" link:** scrolls/navigates to Sources tab.
- **AI examples:** non-interactive in MVP (visually disabled). Phase 3 will make them clickable to open chat.

## Data fetching

All data comes from FastAPI backend at `NEXT_PUBLIC_API_URL`. Use TanStack Query (react-query) for caching and refetching. Default stale time: 60 seconds.

Endpoints used by Overview page:
- `GET /api/brands` — for BrandSelector dropdown
- `GET /api/stats/timeline?brand_id=X&days=N` — for line chart
- `GET /api/stats/sources?brand_id=X&days=N&limit=10` — for SourcesList
- `GET /api/mentions?brand_id=X&limit=8&offset=0&search=&sentiment=` — for MentionsList
- KPI cards are derived from `/api/mentions` total + `/api/brands` count + `/api/stats/sources` array length. Compute on the client; later we'll add `/api/stats/overview` to consolidate.

## What is NOT in MVP

- Sentiment pills with REAL sentiment (always show neutral until Phase 2)
- AnomalyAlert content (always show static placeholder behind blur)
- AI Research Assistant (visual teaser only)
- Multi-brand comparison
- Authentication/login
- Settings page
- Mobile-optimized navigation (hamburger menu)

These are visual stubs that will become functional in later phases. Keep them in the design so the product feels "real" and aspirational.

## Reference mockup

The reference is the interactive HTML widget shown in the design conversation. If anything in this document is ambiguous, ask for clarification before implementing — do not invent.

## Anti-patterns (DO NOT)

- DO NOT add gradients anywhere — sharp colors only.
- DO NOT add rounded corners — even on inputs and buttons.
- DO NOT use Tailwind preset shadows.
- DO NOT use light mode at all.
- DO NOT use Tremor's default color palette — override to match our token list.
- DO NOT add framer-motion or similar animation libraries — opacity transitions and color hovers only.
- DO NOT use sentiment in queries until Phase 2 — backend returns NULL for now, frontend should not crash.
- DO NOT show "0 mentions" empty states with cute illustrations. If empty, show a plain mono message "No mentions in selected period." in text-tertiary.
- DO NOT translate to other languages. English UI for the MVP, content is mixed (mentions can be in any language detected by GDELT).
