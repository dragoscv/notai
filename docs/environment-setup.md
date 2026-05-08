# Environment variables — full setup guide

Notai is **secrets-optional by design**. The app boots and runs every core
feature with just the database + auth secrets set. Everything else
unlocks a feature gracefully when its env vars are present.

This document is the single source of truth for every optional integration.
For each one you'll find: where to get the credentials, where to paste them,
and how to test that it's working.

> **AI providers are managed in the app, not in env files.** OpenAI keys
> and GitHub Copilot connections live under
> `Settings → AI providers` (`/app/settings/ai-providers`) and are
> encrypted per-user. The `OPENAI_API_KEY` env var below is **only used as
> a server-wide fallback for the background embedding cron job**. End-users
> never need it.

---

## Required (everything else is optional)

| Var | What for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Postgres 17 + pgvector | Local Docker default works out of the box |
| `AUTH_SECRET` | Auth.js session signing | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | Behind a reverse proxy | Set `true` in any non-local env |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google sign-in | See [setup-google-oauth.md](./setup-google-oauth.md) |
| `HOCUSPOCUS_JWT_SECRET` | Realtime collab signing | `openssl rand -base64 32`. Must match the realtime server. |
| `NEXT_PUBLIC_APP_URL` | Absolute URLs in emails, OAuth, MCP | e.g. `https://notai.example.com` |
| `NEXT_PUBLIC_HOCUSPOCUS_URL` | Browser → realtime ws | e.g. `wss://collab.example.com` |

---

## Optional: encryption key for stored AI secrets

| Var | Default if absent | When to set it |
| --- | --- | --- |
| `SECRETS_ENCRYPTION_KEY` | Derived from `AUTH_SECRET` via HKDF-SHA256 | Set this in production if you want to rotate the encryption key independently of `AUTH_SECRET` (rotating `AUTH_SECRET` will invalidate stored AI keys). |

Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Email (Resend) — invites + contact form

```env
RESEND_API_KEY=re_xxx
CONTACT_INBOX=hello@your-domain.com
CONTACT_FROM=Notai <hello@your-domain.com>
```

1. Sign up at <https://resend.com>, verify your sending domain (DKIM + SPF
   records).
2. Create an API key → copy `re_…` into `RESEND_API_KEY`.
3. `CONTACT_INBOX` is where contact-form messages land.
4. `CONTACT_FROM` must use a verified domain.

Without these, share invites still work in dev (logged to the console) but
won't actually send.

---

## Stripe — Pro tier billing

```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

1. Create a product **Notai Pro** at <https://dashboard.stripe.com/products>.
2. Add two recurring prices: monthly (`$6/mo`) and yearly (`$60/yr`).
3. Copy each `price_…` id.
4. **Webhook**: <https://dashboard.stripe.com/webhooks> → endpoint
   `https://<your-domain>/api/stripe/webhook`. Subscribe to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
5. Local testing: `stripe listen --forward-to localhost:15600/api/stripe/webhook`
   then paste the `whsec_` it prints into `.env.local`.

Test card: `4242 4242 4242 4242`, any future date, any CVC.

---

## Sentry — error monitoring

```env
SENTRY_DSN=https://…@o…ingest.sentry.io/…
NEXT_PUBLIC_SENTRY_DSN=https://…@o…ingest.sentry.io/…
SENTRY_ORG=your-org
SENTRY_PROJECT=notai-web
SENTRY_AUTH_TOKEN=sntrys_…   # only needed for sourcemap upload in CI
```

1. Create a Next.js project at <https://sentry.io>.
2. Copy the DSN. Set both `SENTRY_DSN` (server) and
   `NEXT_PUBLIC_SENTRY_DSN` (browser) — they're the same value.
3. For sourcemap upload in CI, create an internal-integration token with
   `project:releases` + `org:read` scopes → `SENTRY_AUTH_TOKEN`.
4. Realtime server uses `SENTRY_DSN` (no public version needed).

---

## PostHog — product analytics (EU host by default)

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

1. Sign up at <https://eu.posthog.com> (or `app.posthog.com` for US).
2. Project Settings → API key → copy `phc_…`.
3. If you self-host PostHog, point `NEXT_PUBLIC_POSTHOG_HOST` at your
   instance.

---

## Asset uploads (S3-compatible)

Works with **Cloudflare R2**, **Google Cloud Storage** (HMAC), or **plain
AWS S3**. Notai signs requests with hand-rolled SigV4 — no SDK needed.

```env
ASSETS_PROVIDER=r2          # informational: 'r2' | 'gcs' | 's3'
ASSETS_BUCKET=notai-assets
ASSETS_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
ASSETS_REGION=auto
ASSETS_ACCESS_KEY_ID=…
ASSETS_SECRET_ACCESS_KEY=…
ASSETS_PUBLIC_BASE_URL=https://cdn.example.com   # optional CDN origin
```

### Cloudflare R2

1. Dashboard → R2 → Create bucket `notai-assets`.
2. Manage R2 API tokens → "Object Read & Write" → bucket scope = your
   bucket → copy `Access Key ID` + `Secret Access Key`.
3. `ASSETS_ENDPOINT` = `https://<accountid>.r2.cloudflarestorage.com`
   (no bucket in the path — Notai adds it).
4. Set up a public custom-domain CDN if you want
   `ASSETS_PUBLIC_BASE_URL`; otherwise leave blank and Notai serves
   signed GET URLs.

### Google Cloud Storage (HMAC mode)

1. Create a bucket. Make it private.
2. IAM → Service accounts → create one with role
   `Storage Object Admin` on the bucket.
3. Storage → Settings → Interoperability → Create HMAC for that service
   account → copy `Access ID` + `Secret`.
4. `ASSETS_ENDPOINT=https://storage.googleapis.com`,
   `ASSETS_REGION=auto`.

### AWS S3

1. Create a bucket + IAM user with `s3:PutObject` / `s3:GetObject`.
2. `ASSETS_ENDPOINT=https://s3.<region>.amazonaws.com`,
   `ASSETS_REGION=<region>`.

---

## Cron jobs

```env
CRON_SECRET=min-16-char-random-string
```

Used by the trash-purge and embed-notes endpoints to authenticate
non-Vercel schedulers (cron-job.org, GitHub Actions, etc.):

```
GET https://<your-domain>/api/cron/embed-notes
Authorization: Bearer <CRON_SECRET>
```

On Vercel, the `vercel.json` cron entries automatically include the
`x-vercel-cron: 1` header and bypass `CRON_SECRET`. You only need it
elsewhere.

---

## Optional: OpenAI **server-wide** fallback for the embedding cron

```env
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_WHISPER_MODEL=whisper-1
```

End-users **do not** need to set anything in env to use AI features — they
add their own keys via `Settings → AI providers`. Set this only if you
want the **background embedding cron** to embed everyone's notes using a
shared key (otherwise embeddings happen the next time each user makes a
request after they've connected a provider).

---

## Rate limiting (optional)

```env
UPSTASH_REDIS_REST_URL=https://…upstash.io
UPSTASH_REDIS_REST_TOKEN=…
```

Without these, Notai falls back to in-memory rate limits per server
instance — fine for single-host deploys, useless behind a load balancer.

---

## Quick-test checklist

After editing `.env.local`, restart the dev server and verify:

| Feature | How to test |
| --- | --- |
| Email (Resend) | Share a note with a non-existing user → check inbox |
| Stripe | Hit `/app/settings/billing` → "Upgrade" → use 4242 test card |
| Sentry | Trigger a 500 (e.g. visit `/api/throw-test` if you add one) |
| PostHog | Open the app → check live events feed |
| Assets | Drop a file in the editor → confirm upload + render |
| Cron | `curl -H "Authorization: Bearer $CRON_SECRET" $URL/api/cron/embed-notes` |
| AI | `Settings → AI providers` → connect → ask "what notes do I have?" |
