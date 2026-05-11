# GDPR / Privacy compliance audit

_Last reviewed: 2025_

This is a living document tracking how Notai handles personal data, what
third parties touch that data, and which controls users have. Update it
whenever a vendor, cookie, or data flow changes.

## Data we store about users

| Field                         | Source                | Lawful basis             | Retention                                                     |
| ----------------------------- | --------------------- | ------------------------ | ------------------------------------------------------------- |
| Email, name, avatar           | OAuth (Google) signup | Contract                 | Until account deletion + 30-day grace                         |
| Notes, drawings, attachments  | User-generated        | Contract                 | Until user deletes (or account deletion + grace)              |
| WebAuthn credential metadata  | Passkey enrollment    | Contract                 | Until user removes / account deletion                         |
| Sessions, accounts (Auth.js)  | Sign-in               | Contract                 | 7 days (sliding) / explicit sign-out                          |
| Stripe customer + subscription| Billing               | Contract                 | 7y (legal) — minimal fields synced (`customer_id`, plan only) |
| Email suppressions            | Bounce / complaint    | Legitimate interest      | Permanent (deliverability)                                    |
| Audit log                     | Admin / security      | Legitimate interest      | 12 months                                                     |
| `last_seen_at`                | Page visits           | Legitimate interest      | Until account deletion                                        |

We do **not** store IP addresses in the application database, payment
card data (handled by Stripe), or precise geolocation.

## Sub-processors

| Vendor              | Purpose                  | Data flowing                       | DPA               | Region        |
| ------------------- | ------------------------ | ---------------------------------- | ----------------- | ------------- |
| Vercel              | Hosting / Edge           | All HTTP traffic                   | Yes (vercel.com)  | Global edge   |
| Neon (Postgres)     | Primary DB (prod)        | All app data                       | Yes               | EU (Frankfurt)|
| Google              | OAuth sign-in            | Email, name, avatar (one-shot)     | Yes               | Global        |
| Stripe              | Billing                  | Email, plan, payment method        | Yes               | EU/US         |
| Resend              | Transactional email      | Email address, message body        | Yes               | EU/US         |
| Sentry              | Error monitoring         | Stack traces, replay (gated)       | Yes               | EU            |
| PostHog             | Product analytics        | Pageviews, autocapture (gated)     | Yes               | EU            |
| Cloud Storage (GCS) | Backups + attachments    | DB dumps, user-uploaded files      | Yes (Google Cloud)| EU            |

## Cookies

| Name                          | Purpose                             | Category    | Lifetime |
| ----------------------------- | ----------------------------------- | ----------- | -------- |
| `__Secure-authjs.session-token` (or `authjs.session-token` in dev) | Session       | Necessary   | 7 days   |
| `notai_consent`               | Records cookie banner choice        | Necessary   | 12 months|
| `notai_webauthn_chal`         | WebAuthn challenge during sign-in   | Necessary   | 5 minutes|
| Stripe `__stripe_*`           | Fraud prevention on Checkout        | Necessary   | per Stripe|
| `ph_*` (PostHog)              | Product analytics                   | Analytics   | 12 months — **only set after consent**|

Sentry uses `localStorage` rather than a cookie for replay storage; it
is also gated behind analytics consent.

## User rights

| Right          | How                                                                                  |
| -------------- | ------------------------------------------------------------------------------------ |
| Access         | `GET /app/settings/account/export` (JSON dump of notes + metadata)                   |
| Rectification  | `/app/settings/profile`                                                              |
| Erasure        | `/app/settings/security` → "Schedule deletion" (30-day grace, then hard delete)      |
| Portability    | Markdown export per note + ZIP export of all notes                                   |
| Restriction    | Email `privacy@notai.app` — handled manually within 30 days                          |
| Objection      | Reject analytics in cookie banner; revoke any time via footer "Cookie settings"      |
| Withdraw consent | Cookie banner "Reject all" or change in `/cookies`                                 |

## Security controls

- All traffic over TLS 1.3; HSTS preloaded
- Passwordless auth (Google OAuth + passkeys)
- WebAuthn credentials stored as raw bytes in Postgres (no exportable secrets)
- Session cookie is `__Secure-`, `HttpOnly`, `SameSite=Lax`
- Rate-limited sign-in + sensitive APIs
- Nightly `pg_dump --format=custom`, SHA-256 verified, optional GCS upload
- Self-serve account deletion with a 30-day grace window enforced by a cron purge

## Open follow-ups (track in `docs/competitive-analysis.md`)

- DPA template (`docs/dpa-template.md`) — TODO
- Subject Access Request runbook — TODO
- Per-region routing (Neon Frankfurt vs Cloud SQL) doc — TODO
- Annual penetration test cadence — TODO
