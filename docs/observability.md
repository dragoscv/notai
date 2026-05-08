# Observability

Notai's observability stack is **opt-in across the board**. Every integration is
gated behind an env variable so dev and CI builds never need any of the keys.

## Sentry — error + performance monitoring

Sentry is wired into three runtimes:

- **Web (Node + Edge + browser)** — `apps/web/sentry.{server,edge,client}.config.ts`
  and Next.js's `instrumentation.ts` register hook.
- **Realtime server** — `apps/realtime-server/src/index.ts` calls `Sentry.init`
  when `SENTRY_DSN` is set, and wraps the snapshot writer in `try/catch` →
  `Sentry.captureException`.
- **Browser session replay** — only enabled in production (`tracesSampleRate: 0`
  in dev). Inputs are masked by default.

Required env (all optional):

| Variable                 | Where        | Purpose                          |
| ------------------------ | ------------ | -------------------------------- |
| `SENTRY_DSN`             | server       | Server runtime + realtime server |
| `NEXT_PUBLIC_SENTRY_DSN` | client       | Browser SDK                      |
| `SENTRY_ORG`             | build        | Source maps upload               |
| `SENTRY_PROJECT`         | build        | Source maps upload               |
| `SENTRY_AUTH_TOKEN`      | build        | Source maps upload               |

## PostHog — product analytics (EU-hosted)

PostHog is loaded only when `NEXT_PUBLIC_POSTHOG_KEY` is present. We default
the host to `https://eu.i.posthog.com` and use `person_profiles: 'identified_only'`
so anonymous visitors never get a profile.

The `<AnalyticsProvider>` in `apps/web/src/app/layout.tsx`:

- Identifies signed-in users (`userId`, email, name) on mount.
- Sends `$pageview` whenever the path or query string changes.
- Includes UTM params in the page-view payload automatically.

## Logging conventions

- The web app logs only **structured** errors via Sentry — never `console.error`
  for production-relevant failures.
- The realtime server prints lifecycle events to `stdout` (Cloud Run captures
  them) and also reports exceptions through Sentry.
- All cron endpoints return JSON `{ ok|skipped|embedded|... }` so we can pull
  metrics straight from the Vercel cron history.

## Health checks

- `GET /api/health` (web) — DB ping + auth secret check.
- The realtime server has a `/healthz` route bound to the same port.
