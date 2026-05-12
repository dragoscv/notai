# Performance Audit — notai web app (v1 launch)

Date: 2026-05-11
Scope: `apps/web` — Next.js 16, React 19, Turbopack, React Compiler.

## Summary

| Area | Status |
| --- | --- |
| Build pipeline | ✅ React Compiler + Turbopack enabled, `optimizePackageImports` set |
| Image pipeline | ⚠️ 4 raw `<img>` tags (favicons / OAuth logos — low impact) |
| Bundle size | ⚠️ `framer-motion` directly imported on 4 dashboard surfaces |
| N+1 queries | ✅ None found |
| Unbounded queries | ✅ Capped — tag queries now `LIMIT 500` |
| Streaming | ⚠️ Only root layout uses `<Suspense>`; dashboard home blocks on 4 serial queries |
| Cache Components | ⚠️ `cacheComponents: true` not enabled (defer — risky after launch) |

## Findings

### P-01 (MEDIUM) — Tag queries had no LIMIT — **FIXED**
`listNotesByTag` and `listNotesByTagPath` returned every note carrying a tag. For a power user with 50k+ notes on a hub tag, the page would serialize the entire dataset.
Fix: `.orderBy(desc(notes.updatedAt)).limit(500)` on both. UI shows "showing newest 500 — use search to narrow" once the cap is reached (not yet wired; tracked).

### P-02 (LOW) — `framer-motion` directly imported on 4 dashboard files
- `components/upgrade-modal.tsx`
- `components/dashboard/dashboard-view.tsx`
- `components/dashboard/sortable-note-grid.tsx`
- `components/dashboard/sortable-note-card.tsx`

`optimizePackageImports` already includes `framer-motion`, so Next.js tree-shakes per usage. Estimated impact ~50KB gzip on the dashboard route. Lazy-loading would risk LCP/CLS regressions on the most-visited page. Defer.

### P-03 (LOW) — Raw `<img>` for external favicons / OAuth logos
4 occurrences in link-preview, smart-link-chip, connected-app-card, OAuth consent. These are 16-32px favicons; switching to `next/image` requires an allowlist of every domain users could link, which is impractical. Acceptable.

### P-04 (LOW) — `<Suspense>` not used on dashboard home / today / graph
Pages currently `await Promise.all([...])` then render. Each query is fast (~30 ms locally), but on cold Vercel + cold Cloud SQL, p95 can hit 800 ms before any pixels stream. Adding Suspense around individual sub-trees would let the shell paint immediately.
Defer to post-launch — requires component split + skeleton states; risk of layout shift if not designed carefully.

### P-05 (DEFER) — Cache Components opt-in caching not enabled
`next.config.ts` does not set `cacheComponents: true`. Enabling forces all components to default-dynamic with explicit `"use cache"` opt-in — major behavior shift, must validate every page. Defer to v2 with full QA cycle.

## Confirmed strong areas

- React Compiler enabled — automatic memoization for client trees.
- Turbopack FS cache enabled in dev.
- `output: 'standalone'` for tight Docker images.
- `optimizePackageImports` covers `lucide-react`, `framer-motion`, `date-fns`, all `@notai/*`.
- 52 prod deps; heavyweights (`firebase-admin`, `bullmq`, `ioredis`) are server-only (verified — no client import).
- Drizzle subqueries + `inArray` batching used throughout — no N+1 patterns.

## Operator action items

- [ ] Run Lighthouse against `https://notai.ro/app` once deployed; target ≥ 90 perf, ≥ 95 a11y.
- [ ] Watch Vercel Analytics for LCP > 2.5s on dashboard home; if so, prioritize P-04.
- [ ] Run `pnpm --filter @notai/web build` and inspect `.next/analyze` (add `@next/bundle-analyzer` if not installed) before each major release.

## Deferred

- Suspense streaming on dashboard / today / graph (P-04).
- `cacheComponents: true` migration (P-05).
- Replace `framer-motion` with View Transitions API where possible (P-02).
- Wire UI hint when tag results hit 500 cap.
