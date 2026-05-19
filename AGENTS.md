<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# u24-pulse-web

Internal topic-monitoring dashboard for the u24 media team. Frontend-only repo — the backend is the FastAPI service in `ggos24/monitoring-tool` (private), deployed to Railway. This app is a pure read-mostly client of that backend, deployed to Vercel.

The data primitive is a **Topic** (saved search query the system tracks across news sources). Internal TS types and API paths use `Topic`/`/api/topics`. UI copy mirrors that. The app was originally scaffolded around "Brand" — that term is fully retired; if you see it anywhere, it's stale and should be renamed.

## Stack

- **Framework:** Next.js 16 (App Router, src/ layout, Turbopack dev)
- **Styling:** Tailwind 4 (CSS-first config via `@theme`/`@import`) + shadcn/ui (`base-nova` style, neutral base color, dark mode only)
- **Data:** TanStack Query v5 for fetching/caching, native `fetch` (no axios)
- **Charts:** Recharts
- **Icons:** lucide-react
- **TypeScript:** strict mode (default)

Sources of truth:
- **`DASHBOARD_DESIGN.md`** — visual specification. If you're touching UI, read it first. If reality conflicts with the spec, update the spec, then sync the code.
- **Backend API:** see `src/lib/types.ts` and `src/lib/api.ts` for the contract. Pydantic models live in `../u24-pulse/app/api/dashboard.py` and `../u24-pulse/app/api/jobs.py`.

## Project layout

```
src/
  app/
    layout.tsx       # html.dark, font vars, <Providers>
    page.tsx         # Overview dashboard (/)
    sources/         # /sources — domain country override + future GDELT/GN/RSS/Firehose config
    settings/        # /settings — topic CRUD, scheduler info
    api/admin/       # server-side proxies that inject X-Admin-Key (topics, country)
    globals.css      # @theme + dark tokens, all radii forced to 0
  lib/
    api.ts           # apiClient — all fetch calls live here. `localApi` for admin proxies.
    types.ts         # mirrors backend Pydantic models
    country.ts       # iso2ToFlagEmoji, countryName (Intl.DisplayNames), ALL_ISO2 list
    providers.tsx    # QueryClientProvider (staleTime 60s, retry 1)
    utils.ts         # shadcn `cn` helper
  components/
    dashboard/       # Overview-page components (TopBar, KpiGrid, CountryFilter, …)
    sources/         # /sources-page components (DomainCountryOverride)
    settings/        # /settings-page components
    ui/              # shadcn components (button, input, badge, skeleton, dropdown-menu)
components.json      # shadcn config
DASHBOARD_DESIGN.md  # design spec — source of truth for UI
```

## Design rules (non-negotiable)

From `DASHBOARD_DESIGN.md`:

- Black `#000` background, dark `#09090b` cards. **No light mode.**
- **Sharp 0px corners everywhere** — `--radius` and all `--radius-*` tokens are forced to 0 in `globals.css`. Don't add `rounded-*` classes.
- No gradients, no shadows, no glow.
- Typography: Inter/system sans for content, Geist Mono for labels/timestamps/KPI deltas. Weights 400/500 only.
- Sentence case in copy. UPPERCASE only for `letter-spacing: 0.1em` mono kicker labels.
- Card grids: 1px gaps simulated via `display:grid; gap:1px; background:var(--border)` — cards themselves have no borders.

## Anti-patterns (DO NOT)

- No rounded corners. No light mode. No framer-motion.
- No sentiment-based queries until Phase 2 (backend returns NULL — UI must not crash).
- No empty-state illustrations — plain mono "No mentions in selected period." in `text-tertiary`.
- **No proxy routes for backend calls** — CORS is configured on the backend (`http://localhost:3000` + regex for `*.vercel.app`), call Railway directly from the browser.

## Backend connection

- `NEXT_PUBLIC_API_URL=https://web-production-c3b4.up.railway.app` — base URL for browser-side reads. Required.
- `ADMIN_API_KEY=<value>` — required for **any admin write** (topic create / AST edit / domain country override). Read **only** by Next.js route handlers under `src/app/api/admin/*` which inject it as `X-Admin-Key` before forwarding to the backend. **Never expose to the browser** (no `NEXT_PUBLIC_` prefix). Same value the FastAPI backend has in its `.env`. Without it, admin endpoints return HTTP 500 `"ADMIN_API_KEY not configured on the frontend server"`.
- Local: both vars in `.env.local` (gitignored). Restart `npm run dev` after editing — Next reads env at boot.
- Vercel: set in project settings → Environment Variables (Production + Preview + Development).
- Backend CORS allows `http://localhost:3000` exactly + regex `https://.*\.vercel\.app`. If you change the local port or add a new origin, edit `../u24-pulse/app/main.py` and redeploy.

## Admin-write pattern

Browser → `localApi()` in `src/lib/api.ts` → `/api/admin/<resource>` Next route handler → injects `X-Admin-Key` → FastAPI backend. Keeps the key server-side and surfaces FastAPI's `detail` field verbatim so 422/400/500 messages reach the operator. Anti-pattern: do NOT put the admin key in localStorage or any client-side state.

## Commands

```
npm run dev      # Next dev server on port 3000 (Turbopack)
npm run build    # production build
npm run start    # serve production build locally
```

Deployment is automatic — `git push origin main` triggers a Vercel build via the GitHub integration. There is no manual CLI deploy step.

## Phases

- **Stage 1 (done):** scaffold + connection test on `/`.
- **Stage 2:** implement components from `DASHBOARD_DESIGN.md` — TopBar, TopicSelector, PeriodToggle, KpiCard, ChartCard, SentimentBreakdown (coming-soon), AnomalyAlert (coming-soon), SourcesList, MentionsList, SentimentPill, ComingSoonBadge, ResearchAssistantTeaser, Footer.
- **Stage 3:** compose the Overview page from those components.

## Repos and URLs

- **Frontend (this repo):** https://github.com/ggos24/monitoring-tool-frontend
- **Backend:** https://github.com/ggos24/monitoring-tool (Railway-deployed)
- **API (production):** https://web-production-c3b4.up.railway.app
