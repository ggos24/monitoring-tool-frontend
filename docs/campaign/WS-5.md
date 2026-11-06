# WS-5 — Frontend, pass 1

Branch: `claude/campaign-ws5-frontend-5b7b80`. Front-end only; no new API.

## Done
- **Nav:** Overview · Reports · Settings. Removed `/narratives` (narratives-on-the-fly,
  `components/narratives/*`, `lib/narrative-view*`), ResearchAssistant, and the dead
  AnomalyAlert / TopicSelector (no importers).
- **Trust UI removed:** SourceQualityBreakdown, Quality toggle + `score_band`, trust/reach/combo
  badges (`domain-score-badge`, `reach-badge`, `trust-reach-badge` deleted), priority sort,
  agg/contested domain marks, RSS publisher trust badge. Countries stay. Storyline cards
  lost "Reach share" / "Mean reach".
- **Bug:** MentionsList now queries `effectiveRanges(days, selectedDay)` — same window
  as the KPIs/charts (was: only the drilled day, otherwise all-time).
- **KPI:** "Compare to previous period" switch (default on). On: Δ% badge + "· prev 7d N"
  under each card. Off: absolute values only, previous-window queries disabled.
- **Favorability:** `src/lib/favorability.ts` — supportive→Favorable, critical→Unfavorable,
  neutral, mixed; tooltip "How favorable the article's content is to Ukraine". Used in
  Mentions filter/pills and every report panel.
- **Reports:** header + Download PDF → Bottom line → Storylines → Coverage & favorability
  vs previous period → collapsed Details (metrics, what changed/watchlist/caveats, data
  quality, breakdowns). Comparison block: coverage = `/api/mentions … limit=1` totals for
  the report window vs the equal window before; favorability = current mix from
  `aggregates.sentiment_distribution` (previous-period favorability waits for
  `/api/stats/favorability`). Hidden when neither has data. Copy says "change in
  coverage", not campaign effect.
- **PDF:** `window.print()` + `@media print` in `globals.css` (ink-on-paper token flip,
  `print:hidden` on nav/aside/buttons/Details, page break between `.storyline-card`s).
  `beforeprint` expands all storylines + bodies (flushSync), `afterprint` restores.
- **Report form:** behind "New report"; scope (This narrative / All narratives), period,
  Generate. "All narratives" = topic group named `Campaign` (WS plan); disabled until it
  exists. Removed SegmentFilterBuilder usage, Format picker, Save-as-scheduled. Country
  prefill from Overview survives as removable chips.
- **Settings:** `/settings` = Narratives (rename only — PATCH sends `{name}` only) +
  scheduler. `/settings/advanced` = narrative definitions (active toggle, Edit AST, new
  topic), topic groups, enrichment, prompts, scheduled digests (moved off Reports).
- **Pool:** `Topic.role?`; `visibleTopics()` hides `role === "pool"` from the scope
  selector, the Overview auto-select and the Narratives list. Shows everything while the
  backend doesn't send `role`.

## Pass 2 hooks
- `PeriodComparison` (report-detail.tsx) — swap the favorability half to
  `/api/stats/favorability` for current + previous.
- KPI grid already has `compare`; add Favorable share / Share of Tier-1 there.
- `SourceQualityBreakdown` slot on Overview is now a full-width timeline — favorability
  panel goes back into a 2/3 + 1/3 split.

## Not touched
- `sentiment-breakdown.tsx` (coming-soon, unused) and `segment-filter-builder.tsx`
  (still used by the scheduled-digest create form under Advanced).

## Verification (2026-11-05)
- `npx tsc --noEmit` (+ `--noUnusedLocals`), `npm run build`, `npm test` — clean. The repo
  has no ESLint config, so there is no separate lint step.
- Prod had **zero topics/reports** during verification (old topics deleted per plan; the API
  was also returning 500s for ~4 min). Visual checks ran against a local fixture server
  that mimics the API shapes (3 narratives + a `role: "pool"` topic, a `Campaign` group,
  one intelligence-brief report). Checked: Overview (KPIs with Δ + prev, 7d→30d changes the
  Mentions total, pool absent from picker), Reports (block order, comparison block,
  New report form), Settings (rename-only), and a headless-Chrome print-to-PDF (3 A4 pages,
  no nav/buttons, storylines expanded, one per page).

# Pass 2 (branch `claude/campaign-ws5-pass2`, stacked on pass 1)

Built against the WS-4 contract (`u24-pulse` PR #9, `docs/campaign/WS-4.md`), verified on a
local mock of that contract — PR #9 was not merged at the time.

- **Window model** (`src/lib/period.ts`): `Period` = preset days | explicit UTC day range;
  `resolveWindow()` → `DateWindow {from, to, prevFrom, prevTo, days, granularity, label,
  prevLabel}`. Every panel takes `win` instead of `days`/`selectedDay` and always sends
  `date_from`/`date_to`. Previous window ends 1 ms before `from` (backend bounds are inclusive).
  The timeline gets the period window; every other panel gets the day-drilled one.
- **Period picker:** 24h · 7d · 30d · 90d · Campaign · Custom (two UTC date inputs, ≤ 400 days).
  Campaign dates come from `NEXT_PUBLIC_CAMPAIGN_START` / `NEXT_PUBLIC_CAMPAIGN_END`
  (`YYYY-MM-DD`, end optional = today). **Unset → Campaign is disabled.** Set them in Vercel
  once product confirms the dates.
- **Timeline:** dashed line for the previous window, aligned by position; tooltip shows both dates.
- **Favorability panel** (replaces the old Source quality slot): mean −2…+2 with Δ, stacked bar,
  per-label count/share/Δ pp, unscored count. `useFavorability()` is shared with the KPI.
- **KPIs:** Total mentions · Share of Tier-1 coverage (narrative total ÷ pool total, same window
  and country; pool = `role === "pool"`; "—" when no pool) · Favorable share (favorable ÷ scored,
  Δ in pp) · Sources · Top countries. Daily average dropped.
- **Δ in sources and countries:** per-row absolute change vs previous window ("+12", "−3", "new");
  previous sources fetched with limit 100 so a domain that slipped out of the top 25 isn't "new".
- **Narrative tabs:** All narratives (`Campaign` group, `group_id`, deduped by backend) + one tab per
  narrative; default = All narratives when the group exists. In group scope each mention shows
  chips for its `topic_ids`.
- **Title-only:** `enrichment_basis === "title_only"` → "title only" mark next to the
  favorability pill.
- Also fixed: "Generate report" passed UTC times into the form's local datetime inputs.

Not done in pass 2: Campaign preset in the report form; favorability `series` is fetched but not
charted (no spec for it yet).

## Pass 2 against live prod (2026-11-05, after backend PR #9 deploy)
Read-only. Prod had only the pool (id 12, `role: "pool"`, 0 mentions); no narratives, no
`Campaign` group. Every Overview call was exercised by temporarily showing the pool as a tab
(local only, reverted): topics, topic-groups, overview, mentions (current/prev/pool), timeline
(day, hour, 90d, 309-day custom + prev), favorability (current/prev), sources, sources/count,
countries — all 200, shapes identical to the mock. `group_id=999` → 404 as specified; 401-day
range → 422, 400 → 200 (matches the picker's 400-day guard).
- **Mismatch fixed:** previous-window `/api/stats/sources` used `limit=100`; backend caps it at
  50 → 422. Now 50.
- Not observable live yet (0 mentions): `topic_ids` / `enrichment_basis` values. Field names and
  types checked against `MentionOut` in `app/api/dashboard.py` on backend `main`.

# GKG follow-up (branch `claude/campaign-ws5-gkg`, PLAN §9)

Merged contract from the coordinator (2026-11-06), built against backend PR #17
(`app/api/campaign.py`, router prefix `/api/campaign`). Fields marked *WS-4 adding* are typed
optional in `src/lib/types.ts`; their names are my best guess and are isolated there.

| Endpoint | Used by | Notes |
|---|---|---|
| `GET /api/campaign/coverage` → `CoverageBlock {available, source, counts{visible,sparse,invisible}, outlets{…}}` + *`selector_version`*, *`measured_from/_to`* | footnote, KPI grid | hidden on 404 or `available=false` |
| `GET /api/campaign/headline?topic_id\|group_id&date_from&date_to&selector_version&`*`country_iso2`*`&u_limit=0` | KPI grid | one call per window; `selector_version` passed verbatim from coverage |
| `GET /api/campaign/pickups?date_from&date_to&limit` → same shape as headline `u` (`{articles, by_signal, items[{mention_id, topic_id, url\|null, title, outlet, published_at, signals[]}], truncated}`) | pickups panel | *WS-4 adding*; 404 → hidden, 422/other → error text |
| `GET /api/mentions` / `/api/stats/sources` with `source=gn\|rss&exclude_gkg=true` | live panel | *WS-4 adding* `exclude_gkg` |

- **KPI grid** (`campaign-kpi-grid.tsx`): Tier-1 articles · Share of Tier-1 coverage (`pool_share`) ·
  Favorable share · Outlets · Top countries (only when *`headline.countries`* is present).
  - Favorable share shows **n/a** unless scored articles are the majority (enrichment is off,
    so most rows are unscored).
  - `mixed_selector_versions=true` in either window → error message instead of numbers.
  - *`last_ingested_at`* (assumed name): `null` or before the window with 0 articles →
    "Live data not ingested yet"; inside the window → numbers plus "ingested through …".
  - 404 → falls back to the old generic-endpoint grid (pre-#17 backends).
- **Footnote**: "Figures cover N fully and M partially of T Tier-1 outlets that GDELT
  indexes." (default wording) + measurement window when present; expands to the three outlet
  lists. Selector id only in the tooltip. The "agencies are in the live GN panel" sentence is
  dropped while GN is off and RSS is inactive.
- **Live GN/RSS panel**: `exclude_gkg=true`, error state, "Live source not active" when 0,
  never compares.
- **Pickups**: list with `text` / `headline` / `link` labels per signal; a `null` url renders
  the title without a link.
- **Campaign defaults**: Overview opens on the Campaign preset when its dates are configured
  (default; else 7d). Top sources never shows Δ while the source filter is GN or RSS.

Example rows (coverage CSV): `bbc.com` is the canonical BBC domain; `reuters.com` is
**sparse** (partially visible), not invisible.
