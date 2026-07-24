# u24-pulse Dashboard — Design Specification

This document is the **source of truth** for the Next.js frontend look-and-feel. Implement components to match this spec; if reality conflicts with the spec, update the spec first, then sync the code.

## Visual identity

- **Aesthetic:** Vercel/Linear-inspired. Black background, sharp rectangular corners, monospace accents, information-dense, minimal decoration.
- **No rounded corners anywhere.** All borders, buttons, cards, inputs, badges — sharp 0px radius. This is intentional and non-negotiable.
- **No gradients, no shadows, no glow effects.** Flat surfaces only.
- **Tone:** terminal/devtools. Technical but readable. Confident, not playful.

## Color tokens

Dark theme is the default and only theme for MVP. The palette is mono-emerald — no secondary hue is introduced for interactive emphasis; brightness and the single emerald accent do that work. Source of truth for values is `src/app/globals.css`; `src/lib/theme.ts` mirrors them for Recharts and any other JS consumer.

```
/* Surface ladder — moderate lift from the original near-black palette so
   cards have visible edges and the page has hierarchy. */
--bg-base:         #0a0a0c   (page background — slight off-black, less OLED-harsh)
--bg-card:         #141417   (card surface — clearly lifted from page)
--bg-elevated:     #1c1c20   (hover rows, dropdown trigger active)
--bg-overlay:      #26262b   (dropdown panels, popovers, tooltips)

--border-default:  #2e2e34   (card grid gap divider, default input border)
--border-strong:   #3f3f46   (hover/focused inputs, active chip borders)

/* Text tiers — every role shifts up one step on the zinc scale from the
   original spec so kicker labels stop disappearing into the card. The
   dimmest visible text in the system is now zinc-500. zinc-700 is retired. */
--text-primary:    #fafafa   (body, KPI numbers, mention titles)
--text-secondary:  #d4d4d8   (subheads, list item titles)
--text-tertiary:   #a1a1aa   (metadata, captions, chart tick labels)
--text-muted:      #71717a   (kicker labels — the dimmest visible text)

--accent-success:  #34d399   (positive sentiment, "live" indicator, primary chart line, active state)
--accent-warning:  #fbbf24   (volume spike, anomaly icon)
--accent-danger:   #f87171   (negative sentiment, errors)

--ring:            rgba(52, 211, 153, 0.4)  (focus ring — emerald at 40%)
```

Contrast targets: all body text and interactive labels meet WCAG AA (≥4.5:1) against the surface they sit on. Borders are not required to meet text-contrast minimums but must be visible — `--border-default` (#2e2e34) on `--bg-base` (#0a0a0c) gives ~3:1 so the 1px-gap card grid actually reads.

Sentiment pill colors (border + bg + text). Each variant pairs with a leading glyph so meaning isn't color-only:
- positive (▲): bg `#022c22` (emerald-950), text `#6ee7b7` (emerald-300), border `#065f46` (emerald-800)
- negative (▼): bg `#450a0a` (red-950), text `#fca5a5` (red-300), border `#991b1b` (red-800)
- neutral  (─): bg `--bg-elevated`, text `--text-secondary`, border `--border-strong`
- mixed    (↕): bg `#451a03` (amber-950), text `#fcd34d` (amber-300), border `#92400e` (amber-800)
- muted    (○): bg `--bg-elevated`, text `--text-tertiary`, border `--border-strong` — "Unscored" rows; previously invisible at 1:1 contrast against the card

## Typography

- **Sans-serif:** Inter or system font stack — used for titles, body, KPI numbers
- **Monospace:** "SF Mono", "Geist Mono", monospace — used for: labels, timestamps, domain names, period buttons, KPI changes (▲ 12.4%)
- **No 600/700 weights.** Only 400 (regular) and 500 (medium for emphasis).
- **Sentence case everywhere.** Never Title Case, never ALL CAPS. Exception: monospace labels in `UPPERCASE` with `letter-spacing: 0.1em` for kicker-style headers ("TOTAL MENTIONS", "MENTIONS OVER TIME").
- KPI numbers: 26px, weight 500, `font-variant-numeric: tabular-nums`, `letter-spacing: -0.02em`.
- Mention titles: 14px, weight 400, leading-snug, color text-primary.
- Card kicker labels: 10px monospace, uppercase, letter-spacing 0.1em, color text-muted (#71717a — the dimmest tier we still consider legible).
- Card subtitles (under kicker): 13px, color text-tertiary (#a1a1aa).

## Layout grid

- Max content width: 1440px, centered.
- Padding: 20px on desktop, 16px on mobile.
- All grids use 1px gaps between cards (achieved via `display:grid; gap:1px; background:var(--border)`). The 1px "gap" is the divider color showing through. With `--border-default` lifted to `#2e2e34`, the gap is finally visible against the new `--bg-base` (#0a0a0c).
- Cards have NO border individually — the grid background simulates dividers.

## Components inventory

The dashboard composes from these primitives (build them as reusable React components):

### 1. TopBar
- Height 56px, sticky at top with backdrop blur on scroll.
- Left: logo dot (8×8 emerald square) + "u24-pulse" wordmark in monospace.
- Center: nav links — Overview (`/`), Mentions (stub `#`), Sources (`/sources`), Insights ⓘ (stub `#`), Settings (`/settings`). Active link has `bg-muted` background, others are text-faint with hover to text-secondary. Active state determined by `usePathname()`.
- Right: live status indicator: pulsing 6×6 emerald square + "Live · last sync 2m ago" in monospace text-faint.
- Mobile (<780px): hide nav, keep logo + status.

### 2. TopicSelector (dropdown)
- Trigger button: bg-elevated, border-strong, padding 8/12, monospace prefix "topic:" (text-faint), topic name (medium weight), count in parens (text-faint mono), chevron-down icon.
- On click: dropdown panel below, same width minimum, list of topics with status dot (emerald if active, neutral if disabled), name, count right-aligned in mono.
- Footer row of dropdown: "+ Add new topic" — opens modal (out of scope for MVP, just a visual cue).

### 3. PeriodToggle
- Inline pill group: 24h / 7d / 30d / 90d.
- Container: bg-elevated, border-strong, 2px padding.
- Active button: `#fafafa` background, black text. Inactive: transparent bg, text-faint.
- Monospace, 11px.

### 3b. CountryFilter
- Searchable combobox in the same filter row as PeriodToggle. Built on `@base-ui/react/combobox`.
- Trigger button (`h-8`): when nothing selected → globe icon + "All countries"; when selected → flag emoji + ISO2 (text-faint) + country name + chevron.
- Popup: 288px wide, sharp corners, `z-[100]` on `Combobox.Positioner` (must exceed the `z-10` `backdrop-blur` overlays on AnomalyAlert / SentimentBreakdown — otherwise dropdown rows are blurred when they overlap those cards).
- Search input at top filters by ISO2 or country name. List populated from `GET /api/stats/countries?topic_id=X&days=N` (top 100). Each row: flag + ISO2 + name + count.
- "All countries" is rendered as a separate sticky-top button outside `Combobox.List` — clearing simply calls `onChange(null)` and closes the popup.
- Picker is a **global** filter, like topicId/days. Threaded through SourcesList, MentionsList, TimelineChart, and KpiGrid queries via `country_iso2` query param. Resets when topic changes; resets `selectedDomain` when country changes.
- Items use the **function-children pattern** for `Combobox.List` (`{(item) => <Combobox.Item>}`) — required for the library's internal `filter` prop to take effect. Static `.map()` ignores the filter.
- For the standalone null/Unknown bucket: NOT a selectable option in the filter (keeps the dropdown one-purpose). Rows with `country_iso2 === null` in SourcesList render an em-dash (`—`) in the flag slot.

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
- Line color: emerald (#34d399), stroke-width 1.5, with circular dots at each data point (3px radius, 5px on hover; 2px when there are 24+ points so the hourly view stays clean).
- Grid: only horizontal lines, color border-default, no vertical grid.
- Axes: 10px monospace labels, text-faint.
- Tooltip: bg-elevated, border-strong, no border-radius, monospace 11px.
- **Bucket granularity** (Mentions over time):
  - 24h period → **hourly** buckets (24 points), X-axis ticks `HH:00` UTC, subtitle "Hourly mention count, last 24 hours (UTC)". Daily granularity collapses 24h into 1–2 dots and hides intra-day spikes.
  - 7d / 30d / 90d → **daily** buckets, X-axis ticks `MM-DD`, subtitle "Daily mention count, last N days".
  - Frontend chooses granularity from `days` and passes it as `granularity=hour|day` to `/api/stats/timeline`.
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
- **Column header row** above the list — 9px mono uppercase letterspaced text-faint labels `Domain / Ment. / Tr / Re` separated from data by a 1px zinc-900 underline. `Tr`/`Re` are width-matched (w-8 / w-[18px]) to align over the count + the two badges, with `title` tooltips ("Editorial trust 0-5" / "Audience reach 0-5"). Two score columns since Decision 32 split trust from reach.
- Each source row, left → right: favicon (16×16, lazy-loaded from `google.com/s2/favicons`), country flag (emoji, 14px), domain name (mono, text-secondary), optional `AGG` chip, then a right cluster `count + DomainScoreBadge (Trust) + ReachBadge (Reach)` in fixed-width columns (gap-4) so numbers align with their headers. Count uses **mono medium, text-primary, tabular-nums** so it reads as the row's data anchor (faint counts got lost on dark cards).
- Rows arrive grouped by **canonical publisher identity** (Decision 33): backend groups by `source_domain_normalized`, so `www.`-variants and alias domains (`dailymail.com` → `dailymail.co.uk`) merge into one row and `domain` is the normalized name.
- `AGG` chip (when `is_aggregator=true` — yahoo/msn/aol): 9px mono uppercase, 1px border-border, text-muted-foreground. Title-tooltip explains trust/reach describe the platform, not the original publisher. No color — it's a label, not a verdict.
- Country flag is rendered as Unicode regional-indicator emoji (zero deps; see `src/lib/country.ts`). Hover tooltip (`@base-ui/react/tooltip`) shows `<country name> (ISO2) · <confidence>`. Confidence values: `high | medium | heuristic | null`. Null country renders an em-dash (`—`) in the same width to keep alignment.
- No "Country" column header — the flag sits inside the Domain column next to the favicon, which also has no header.
- DomainScoreBadge (TRUST): 18×18 sharp square with the trust digit 0–5 inside; palette runs red (0, propaganda) → orange (1) → zinc (2, unknown) → lime (3) → green (4) → emerald (5, top trusted). Rich hover popover (fetches `/api/scoring/news_domain/{domain}`) now also shows a **Reach** summary (tier/score/band + authority/traffic split) and the DataForSEO signals.
- ReachBadge (REACH, Decision 32): 18×18 sharp square with the reach tier 0–5. **Deliberately a different ramp** — a monochrome **blue "intensity"** scale (`bg-strong` at 0 → `bg-sky-950…600` for 1–5), NOT the red→green trust semantics, so a high-reach propaganda outlet never reads as "good". Reach = how *loud* a source is (audience/authority), not how trustworthy. `null` (no DataForSEO/Tranco signal yet) → dim `—`. Native tooltip: `Reach: N/5 · <band> · <score>/100`. `reach_score` (0-100) is the sort key; the badge shows the derived `reach_tier`.
- Rows are **buttons** — clicking toggles a `source_domain` filter on the Mentions list. Active row: `bg-zinc-900`, brighter domain text. Hover (inactive): `bg-zinc-900/60`. No progress-bar fill — the count + two score badges already carry the data, the bar was redundant noise.
- Footer: "View all 38 sources ↗" — mono, text-faint, opens Sources tab on click. **Use sendPrompt to open natural-language search later.**

### 9. MentionsList
- Filter bar at top — **two rows**:
  - **Row 1:** Search input (bg-elevated, border-strong, magnifying-glass icon, mono 11px, placeholder "Search title or body...") + optional active-domain chip (when SourcesList row toggled) + `SOURCE` ToggleGroup (All / Google News / GDELT / Firehose / RSS). On the right of Row 1: `Reset` link, shown only when at least one filter is active.
  - **Row 2:** `QUALITY` ToggleGroup (All / Trusted / Suspect / Unvetted / Propaganda) + `STANCE` ToggleGroup (All / Supportive / Critical / Neutral / Mixed). `Unvetted` (trust=2 only, Decision 33) is a subset of `Suspect` (trust 1–2) — the "needs vetting" review queue: combine with high-reach sorting in Top sources to find big-but-unverified outlets worth escalating to a third-party trust check.
- `Source` and `Quality` state is **owned by the Overview page**, not MentionsList — both `SourcesList` and `MentionsList` receive them as props. Changing either filter narrows BOTH panels together (`/api/stats/sources` accepts the same `source` + `score_band` params for parity).
- Search is debounced 300ms. Page resets to 0 whenever any filter changes.
- Mention rows (8 visible per page), left → right / top → bottom:
  - Top metadata row: domain (mono, text-faint) · timestamp (mono, text-faint) · *optional* `Enriched` kicker (mono 9px uppercase, shown when row has an LLM summary) on the left; StanceBadge + Re-analyze icon button on the right.
  - Title (13px, text-primary). Title is a `<button>` — click opens `mention.url` in a new tab (`hover:underline`); disabled-looking when `url` is null.
  - Preview line:
    - When `mention.summary` is present → 12px sans-serif `text-zinc-300 leading-snug`, full 2-sentence summary (NOT truncated). This is the LLM verdict that survives body TTL.
    - Else when `mention.body` is present → 11px mono `text-zinc-600` truncated to 1 line with ellipsis (legacy fallback).
    - Else nothing.
  - On hover: bg-hover background.
- **StanceBadge** wraps `SentimentPill` and is data-driven from `mention.stance_label`:
  - `supportive` → `positive` variant, label "Supportive"
  - `critical` → `negative` variant, label "Critical"
  - `neutral` → `neutral` variant, label "Neutral"
  - `mixed` → `mixed` variant (amber), label "Mixed"
  - `null` → `muted` variant, label "Unscored"
  - Tooltip (top-end): `"<Label> stance toward topic · NN% confidence · framing: <label>"`.
- **Re-analyze button** (icon-only, 24×24 sharp square, `border-zinc-800`, `Sparkles` icon, hover lifts to `text-zinc-50`).
  - Calls `POST /api/admin/mentions/{id}/enrich` via the Next admin proxy (`X-Admin-Key` injected server-side; admin-write pattern from AGENTS.md).
  - During pending: `Loader2` spinner, button disabled with `cursor-wait`.
  - On success: full updated `MentionOut` hot-swaps the row in the TanStack list cache via `queryClient.setQueryData` — no global invalidate, no flicker.
  - On failure: 10px red error line under the body (4s auto-dismiss). FastAPI's `detail` surfaces verbatim (e.g. "could not fetch body for mention (fetch_status=403)").
  - Tooltip: "Analyze with LLM" if `stance_label` is null, else "Re-analyze with LLM".
- Bottom: pagination — "Showing 1–8 of 142" (mono text-faint) + prev/next buttons (mono 11px, border-strong, prev disabled at first page).

### 10. SentimentPill (atom)
- Generic pill used by both `StanceBadge` (per-row) and elsewhere if needed.
- Padding 2/6, border 1px, monospace 9px uppercase letter-spacing 0.1em.
- Each variant pairs a color with a leading glyph so meaning is not color-only (accessibility + screenshot legibility). See sentiment pill colors in `Color tokens` above.
- The `muted` variant ("Unscored") sits on `--bg-elevated` with `--text-tertiary` — visible against the card it lives on. The previous implementation collapsed to ~1:1 contrast and disappeared.
- The atom is intentionally vocabulary-agnostic — Stance-vs-Sentiment labelling is the caller's responsibility. Backend vocabulary is `{supportive, critical, neutral, mixed}` (stance toward target topic), NOT `{positive, negative}`.

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
- Items separated by " · ": version, "API docs ↗". Source count and next-sync countdown live in the TopBar status — keeping them only there avoids two clocks ticking out of phase.

## Page composition (Overview = `/`)

Vertical stack from top to bottom:

1. TopBar (sticky)
2. Padding container (max-width 1440px, padding 20px)
3. Row: TopicSelector (left) + [CountryFilter, PeriodToggle] (right)
4. KpiCards grid (4 columns desktop, 2×2 mobile)
5. AnomalyAlert (coming-soon)
6. Two-column row: ChartCard `Mentions over time` (2/3 width) + SentimentBreakdown coming-soon (1/3 width)
7. Two-column row: SourcesList (1/3 width) + MentionsList (2/3 width)
8. ResearchAssistantTeaser (full width, coming-soon)
9. Footer

## Page composition (Sources = `/sources`)

A configuration-style page reachable from the TopBar. Layout follows the Settings page conventions: TopBar + `<main>` with H1 `font-mono uppercase tracking-[0.1em]` + description + stacked `<section>` cards with border-zinc-800.

1. TopBar (sticky)
2. Page header: "Sources" + "Manage domain attribution and source integrations."
3. **DomainCountryOverride** card:
   - KickerLabel "Domain country override" + short description.
   - Free-text input (mono 11px, h-8, magnifying-glass prefix) + "Look up" submit button. Enter on the input triggers the same lookup.
   - Input normalization strips `http(s)://`, `www.`, path. Validated against a basic FQDN regex before fetching.
   - On lookup → `GET /api/scoring/country/{domain}`. 404 is non-fatal — message: "No attribution data for X yet — you can still set one below."
   - Result card shows: domain (mono 13px, text-primary) + `Current:` flag + ISO2 + name + ` · ` + provider + ` · ` + confidence.
   - Below: country picker (separate `CountryPicker` — same `@base-ui/react/combobox` pattern as the global CountryFilter, but populated from the full 249-entry `ALL_ISO2` list, not `/api/stats/countries`), Save override (emerald), Force re-resolve (zinc, RotateCcw icon).
   - Checkbox "Save as Unknown (force unresolved bucket)" disables the picker and sends `country_iso2: null` to PATCH.
   - Inline hint after the actions: "Manual overrides are stored as `provider=manual_admin` and may be replaced by the next ingestion tick if GDELT also returns attribution for this domain. For a permanent fix, contact engineering to add the domain to `domain_country_overrides.csv`."
   - All admin writes go through `/api/admin/country/[domain]` (Next route handler injecting `X-Admin-Key`). On success, invalidates `["sources"]`, `["countries"]`, `["sources-count"]` query caches so the Overview reflects the new attribution.
4. **RssFeedsEditor** card (`components/sources/rss-feeds-editor.tsx`):
   - KickerLabel "RSS feeds" + short description + `+ New feed` button (top-right, white-on-black).
   - List of feeds (`GET /api/rss-feeds`), ordered `is_active DESC, created_at DESC` — never re-sorted client-side. Per row:
     - **Health dot + label** derived from `is_active` + `last_polled_at` + `last_success_at` + `consecutive_failures`:
       - ⚫ `Inactive` (manual disable) · 🟢 `Healthy` · 🟡 `Degraded` (1–9 fails) · 🔴 `Stalled` (≥10 fails or last_success >7d ago) · ○ `Never polled`.
       - Note: distinct icons for Inactive vs Stalled (the backend spec collapsed them — UI must NOT).
       - Tooltip on degraded/stalled shows `last_error` verbatim.
     - Display name (truncated) + `publisher_domain_normalized` + reused `DomainScoreBadge` (same trust palette as SourcesList).
     - URL line: full URL in mono, truncated with copy-to-clipboard icon button.
     - Meta line: relative `Polled` / `Success` timestamps.
     - Actions: `Active/Inactive` toggle (calls PATCH `is_active`), `Edit` (inline name edit; URL is read-only — spec preserves ETag history on URL change by forcing delete+recreate), `Trash` icon (opens inline confirm with red left border).
   - Empty state: dashed-border card with "Add first feed" button + 5 publisher suggestion chips (BBC World / Guardian World / AP Top News / DW English / Al Jazeera). Chips click → opens Add form with the suggestion pre-filled.
   - Add form: inline expansion (no modals — design system has zero rounded corners and no shadows; modals stand out as foreign). Client-side URL validation on blur; 409 → "This feed URL already exists"; 422 → FastAPI `detail` extracted via the improved `api<T>` helper.
   - Optimistic updates throughout: create prepends, update replaces in place, delete filters with rollback on error.
5. **Other sources** card (small `SOON` badge): "GDELT, Google News and Firehose configuration UI is still coming soon." — RSS is removed from this list.
6. Footer.

## Responsive behavior

- 1024px+: full layout as described.
- 780px–1024px: nav still visible, KPI grid stays 4-up, content rows collapse to 1-column stacks.
- <780px: hide nav links in TopBar (keep logo + status), KPI 2×2, all rows full-width single column. Mention preview line hidden (just title + meta).

## Interactions

- **Topic dropdown:** click trigger toggles, click outside closes, ESC closes. Selecting a topic updates dashboard data (refetches). Resets `source`, `quality`, `country`, `selectedDomain`.
- **Period toggle:** clicking refetches data.
- **Search:** debounced 300ms, then refetches `/api/mentions?search=...`.
- **Source / Quality filters:** state lives on the Overview page; selecting a chip refetches **both** MentionsList (`/api/mentions?source=...&score_band=...`) and SourcesList (`/api/stats/sources?source=...&score_band=...`) so the Top sources panel reflects the same slice as the mentions below.
- **Stance filter:** instant — refetches `/api/mentions?stance_label=...`. Vocabulary `{supportive, critical, neutral, mixed}` matches the backend's `stance_label` literal exactly.
- **Mention title click:** opens `mention.url` in new tab.
- **Per-row Re-analyze (Sparkles icon):** synchronous Gemini call, 2–5s. Updated row hot-swaps into the list cache; failure shows inline error.
- **"View all sources" link:** scrolls/navigates to Sources tab.
- **AI examples:** non-interactive in MVP (visually disabled). Phase 3 will make them clickable to open chat.

## Data fetching

All data comes from FastAPI backend at `NEXT_PUBLIC_API_URL`. Use TanStack Query (react-query) for caching and refetching. Default stale time: 60 seconds.

Endpoints used by Overview page:
- `GET /api/topics` — for TopicSelector dropdown
- `GET /api/stats/timeline?topic_id=X&days=N&granularity=hour|day&country_iso2=XX?` — line chart, accepts optional country filter
- `GET /api/stats/sources?topic_id=X&days=N&limit=L&country_iso2=XX?&source=...?&score_band=...?` — SourcesList (limit ≤ 50 enforced by backend). `source` (`gdelt|gn|firehose|rss`) and `score_band` (`trusted|suspect|unvetted|propaganda`) mirror `/api/mentions` so the Top sources panel can couple to the Mentions filter bar. Rows are grouped by `source_domain_normalized` (Decision 33) and include `country_iso2` + `country_confidence` + `is_aggregator` inline. `/api/mentions?source_domain=` matches the same normalized identity, so a row click catches every raw variant of the domain. `GET /api/stats/scoring` (no params) returns the global trust histogram + reach coverage for drift monitoring.
- `GET /api/stats/countries?topic_id=X&days=N&limit=L` — populates the CountryFilter dropdown. Response: `{iso2: string|null, count: number, confidence_breakdown?, top_domains?}[]`. `iso2 === null` is the unresolved bucket (filtered out client-side from the dropdown).
- `GET /api/mentions?topic_id=X&...&country_iso2=XX?&source=...?&score_band=...?&stance_label=...?&enriched=...?` — MentionsList. `stance_label ∈ {supportive, critical, neutral, mixed}`; `enriched` is a bool that scopes to LLM-enriched rows.
- `GET /api/stats/overview?topic_id=X` — TopBar live status, Footer counts, KPI Sources count when **no** country filter is active. **NOT country-aware** — when a country filter is selected, KpiGrid falls back to `/api/stats/sources?limit=50` and uses `.length` (shows "50+" at the cap).

Sources-page endpoints (browser-direct, no admin key — CORS gated):
- `GET /api/rss-feeds` — list feeds (RssFeedsEditor).
- `POST /api/rss-feeds` — body `{url, name}`. 409 on duplicate URL.
- `PATCH /api/rss-feeds/{id}` — body `{name?, is_active?}`. URL not editable by design.
- `DELETE /api/rss-feeds/{id}` — 204; existing mentions preserved.

Admin endpoints (proxied through Next route handlers in `src/app/api/admin/*` that inject `X-Admin-Key`):
- `GET /api/scoring/country/{domain}` — read current attribution. No auth required (read goes direct, not through proxy).
- `PATCH /api/admin/country/{domain}` — set country (body `{country_iso2: string|null}`). `null` forces unresolved bucket.
- `DELETE /api/admin/country/{domain}` — clear cache, resolver re-runs on next ingestion.
- `POST /api/admin/mentions/{id}/enrich` — synchronous re-analyze (Gemini, 2–5s). Returns updated `MentionOut`. Used by the per-row Sparkles icon in MentionsList.

## What is NOT in MVP

- AnomalyAlert content (always show static placeholder behind blur)
- AI Research Assistant (visual teaser only)
- Multi-topic comparison
- Authentication/login
- Mobile-optimized navigation (hamburger menu)
- GDELT / Google News / Firehose admin config UI (Sources page only ships RSS feeds + domain country override for now)

Stance pills are **NOT** in this list anymore — they're driven by the real enrichment pipeline (`stance_label` from `MentionOut`). Until a row is enriched, it shows a muted "Unscored" pill; clicking the per-row Sparkles icon synchronously enriches via Gemini.

These are visual stubs that will become functional in later phases. Keep them in the design so the product feels "real" and aspirational.

## Reference mockup

The reference is the interactive HTML widget shown in the design conversation. If anything in this document is ambiguous, ask for clarification before implementing — do not invent.

## Anti-patterns (DO NOT)

- DO NOT add gradients anywhere — sharp colors only.
- DO NOT add rounded corners — even on inputs and buttons. The shadcn primitives in `src/components/ui/` ship rounded by default; they have been stripped in this repo and any new primitive must follow suit.
- DO NOT use Tailwind preset shadows. shadcn primitives ship `shadow-md/lg`; strip them and use a 1px `border-border` on `bg-overlay` instead.
- DO NOT use `text-zinc-700` (or anything dimmer than `--text-muted` / `#71717a`) for visible text — it almost certainly fails WCAG AA. If you need a "faint" tier, use `--text-muted`.
- DO NOT reach for raw Tailwind color classes (`bg-zinc-950`, `text-zinc-600`, `border-zinc-800`) in components. Use the tokenized utilities (`bg-card`, `text-muted-foreground`, `border-border`) so a single CSS-vars change can re-skin the app.
- DO NOT introduce a secondary accent hue. The palette is mono-emerald; interactive emphasis comes from brightness or the single emerald accent.
- DO NOT use light mode at all.
- DO NOT use Tremor's default color palette — override to match our token list.
- DO NOT add framer-motion or similar animation libraries — opacity transitions and color hovers only.
- DO NOT use sentiment in queries until Phase 2 — backend returns NULL for now, frontend should not crash.
- DO NOT show "0 mentions" empty states with cute illustrations. If empty, show a plain mono message "No mentions in selected period." in text-tertiary.
- DO NOT translate to other languages. English UI for the MVP, content is mixed (mentions can be in any language detected by GDELT).
