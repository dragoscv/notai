# Security Audit — notai web app (v1 launch)

Date: 2026-05-11
Scope: `apps/web` — API routes, server actions, headers, dependencies.
Methodology: OWASP Top 10 (2021) + Next.js 16 specifics.

## Summary

| Category | Status |
| --- | --- |
| A01 Broken Access Control | ✅ Pass — every action/route scopes to `userId`; admin RBAC via `requireAdmin()` |
| A02 Cryptographic Failures | ✅ Pass — bcrypt for API keys (SHA-256 hash), Auth.js v5 sessions, HTTPS-only cookies |
| A03 Injection | ✅ Pass — Drizzle ORM parameterizes all SQL; one safe `new Function()` use in math evaluator (whitelist-protected) |
| A04 Insecure Design | ✅ Pass — PKCE required on OAuth, idempotency on Stripe webhooks, signature verification on inbound email + Resend |
| A05 Security Misconfiguration | ✅ Pass — strict CSP, COOP/CORP, Permissions-Policy, `poweredByHeader: false` |
| A06 Vulnerable Components | ⚠️ See "Operator action items" — run `pnpm audit` before launch |
| A07 Identification & Auth Failures | ✅ Pass — passkeys + Google OAuth, no passwords; rate-limited login routes |
| A08 Software & Data Integrity | ✅ Pass — `--frozen-lockfile` in Vercel, signed commits encouraged, npm provenance on SDK release |
| A09 Logging & Monitoring | ✅ Pass — Sentry on client/server/edge, `audit_log` table, BullMQ webhook delivery log |
| A10 SSRF | ✅ Pass — `link-preview` validates protocol, blocks private IPs (4s timeout, 256 KiB cap) |

## Findings & fixes applied

### F-01 (MEDIUM) — Unrate-limited AI streaming endpoints — **FIXED**
- `/api/ask`, `/api/notes/chat`, `/api/ai/slash`, `/api/push/test` had no IP/user rate limit.
- Risk: a logged-in attacker could spam expensive LLM calls and exhaust `OPENAI_API_KEY` budget faster than the per-plan AI quota (which is monthly).
- Fix: added per-user `rateLimit({ windowSec: 60, max: 20–30 })` at the top of each handler. Push test capped at 5/min.
- Commits: this batch.

### F-02 (LOW) — `new Function()` in `canvas-quick-math.tsx` — **NO ACTION**
- Identifier whitelist (`Math`, `PI`, `E`, sin/cos/...) plus character regex `[A-Za-z0-9_+\-*/().,%^]` rejects `[`, `]`, quotes, `;`, so `Math.constructor` / `Math["constructor"]` / `globalThis` are unreachable.
- Strict-mode wrapper, finite-number check on result.
- Verdict: existing protections are adequate. Consider a proper expression parser (e.g. `mathjs`) only if the surface grows.

### F-03 (INFO) — CSP allows `'unsafe-inline'` for scripts and styles
- Required by Next.js App Router (inline boot script) and Tailwind.
- Mitigated by strict `default-src 'self'`, `frame-src 'none'`, `object-src 'none'`, no `'unsafe-eval'`.
- Future: migrate to nonce-based CSP when Next.js fully supports it for App Router (tracked: Next.js issue #45184).

### F-04 (INFO) — Edge runtime has no DB session check
- `proxy.ts` is pass-through; auth happens in layouts/server actions.
- This is the documented Auth.js v5 + Database Sessions pattern.
- Acceptable: every gated path re-verifies the session server-side.

## Confirmed strong areas

- **Webhooks**: Stripe + Resend + Postmark all verify signatures with timing-safe compare; idempotency keys.
- **OAuth/MCP**: PKCE required, scope intersection, refresh-token rotation, no token enumeration on revoke.
- **Cron**: Vercel platform header OR `CRON_SECRET` Bearer.
- **API keys**: Stored as SHA-256 hash; shown once; per-key + per-scope rate limits.
- **Authorization**: Every Drizzle query for user-owned resources includes `.where(eq(table.userId, userId))` or joins through `noteCollaborators` / `workspaceMembers`.
- **Headers**: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, COOP, CORP, Permissions-Policy, Origin-Agent-Cluster, X-DNS-Prefetch-Control all set in `next.config.ts`.

## Operator action items (pre-launch)

- [ ] Run `pnpm audit --prod` and resolve any critical/high CVEs (none expected — pnpm 10 + frozen lockfile).
- [ ] Verify `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set in Vercel so rate limits are global rather than per-Vercel-instance.
- [ ] Verify `CRON_SECRET` is set and rotated quarterly.
- [ ] Verify `STRIPE_WEBHOOK_SECRET` matches the live endpoint after going live.
- [ ] Verify `AUTH_SECRET` is at least 32 random bytes (`openssl rand -base64 32`).
- [ ] Enable GitHub branch protection: required PR review + status checks on `main`.
- [ ] Enable Dependabot security alerts on the repo.

## Deferred

- Nonce-based CSP (waiting on Next.js).
- Subresource integrity for the Scalar API Reference CDN (low priority — single non-critical doc page).
- Penetration test by external party (recommended within 90 days of launch).
