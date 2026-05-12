# Privacy policy — Notai

Operator: **Vlăduțescu Dragoș Cătălin** (persoană fizică, Romania).
For the canonical, always-current legal text, see <https://notai.ro/privacy-policy>.
Effective date: **2026-05-11** (update on material changes).

## What we collect

| Category               | Examples                                          | Why                                |
| ---------------------- | ------------------------------------------------- | ---------------------------------- |
| Account                | Email, name, OAuth provider id                    | Authentication, account recovery   |
| Content                | Notes, drawings, attachments, properties, tags    | Core service                       |
| Device & usage         | IP, user-agent, page paths (anonymous)            | Abuse prevention, basic analytics  |
| Optional billing       | Stripe customer id, subscription status           | Paid plans (no card data on us)    |
| Optional integrations  | Calendar URLs, BYOK API keys (encrypted)          | Features you opt into              |

We **never** sell or rent your data, train AI on it, or share it with
ad networks.

## How we store it

- Database: PostgreSQL (encrypted at rest by the cloud provider).
- Attachments: S3-compatible object storage with server-side encryption.
- BYOK secrets: encrypted with libsodium-style sealed boxes; only the
  current user's session can request decryption.

## Sub-processors

| Vendor    | Purpose                                | Region |
| --------- | -------------------------------------- | ------ |
| Vercel    | Web hosting                            | EU/US  |
| Neon / GCP Cloud SQL | Managed PostgreSQL          | EU     |
| Stripe    | Payments (paid plans only)             | EU/US  |
| Sentry    | Anonymous error reporting              | EU     |
| PostHog   | Anonymous product analytics            | EU     |
| Postmark  | Inbound email-to-note (optional)       | US     |

## Your rights

You can, at any time, from **Settings → Account**:

- Export every note (Markdown ZIP, includes attachments).
- Delete your account and all associated data within 30 days.
- Revoke OAuth access from your identity provider.

For GDPR/CCPA requests outside the in-app flow, email
**privacy@notai.ro**.

## Cookies

We set a single first-party session cookie for authentication
(`__Secure-authjs.session-token`). No third-party advertising cookies.

## Children

Notai is not directed to children under 13 (or under 16 in the EEA)
and we do not knowingly collect their data.

## Changes

We will announce material changes in-app and by email at least 14 days
before they take effect.
