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
