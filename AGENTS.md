<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# u24-pulse-web

Internal brand-monitoring dashboard for the u24 media team. Frontend-only repo — the backend is the FastAPI service in `ggos24/monitoring-tool` (private), deployed to Railway. This app is a pure read-mostly client of that backend, deployed to Vercel.

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
    page.tsx         # Overview (currently a connection-test stub)
    globals.css      # @theme + dark tokens, all radii forced to 0
  lib/
    api.ts           # apiClient — all fetch calls live here
    types.ts         # mirrors backend Pydantic models
    providers.tsx    # QueryClientProvider (staleTime 60s, retry 1)
    utils.ts         # shadcn `cn` helper
  components/
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

- Env var: `NEXT_PUBLIC_API_URL=https://web-production-c3b4.up.railway.app`
- Local: in `.env.local` (gitignored).
- Vercel: set in project settings → Environment Variables (Production + Preview + Development).
- Backend CORS allows `http://localhost:3000` exactly + regex `https://.*\.vercel\.app`. If you change the local port or add a new origin, edit `../u24-pulse/app/main.py` and redeploy.

## Commands

```
npm run dev      # Next dev server on port 3000 (Turbopack)
npm run build    # production build
npm run start    # serve production build locally
```

Deployment is automatic — `git push origin main` triggers a Vercel build via the GitHub integration. There is no manual CLI deploy step.

## Phases

- **Stage 1 (done):** scaffold + connection test on `/`.
- **Stage 2:** implement components from `DASHBOARD_DESIGN.md` — TopBar, BrandSelector, PeriodToggle, KpiCard, ChartCard, SentimentBreakdown (coming-soon), AnomalyAlert (coming-soon), SourcesList, MentionsList, SentimentPill, ComingSoonBadge, ResearchAssistantTeaser, Footer.
- **Stage 3:** compose the Overview page from those components.

## Repos and URLs

- **Frontend (this repo):** https://github.com/ggos24/monitoring-tool-frontend
- **Backend:** https://github.com/ggos24/monitoring-tool (Railway-deployed)
- **API (production):** https://web-production-c3b4.up.railway.app
