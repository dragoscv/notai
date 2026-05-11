# Changelog

All notable changes to Notai are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each app in this monorepo is versioned independently:

| App                       | Triggers release on                                          |
| ------------------------- | ------------------------------------------------------------ |
| `@notai/web`              | every push to `main` (Vercel git integration, auto-deploy)   |
| `@notai/realtime-server`  | bump in `apps/realtime-server/package.json` merged to `main` |
| `@notai/desktop`          | tag `desktop-v*` (also auto-tagged on `apps/desktop` bump)   |

## [Unreleased]
### Added

- **Workspace seat-based billing** — new `workspace_subscriptions` table
  (migration 0033), per-workspace Stripe checkout with seat quantity,
  workspace-scoped billing portal, and a `/app/workspaces/[id]/billing`
  page with seat picker, cycle, and currency. Member invites now enforce
  paid seat quota (throws `SEAT_LIMIT_REACHED:<n>` when exceeded). Stripe
  webhook routes events by `metadata.workspaceId` to update the new
  table; existing per-user `subscriptions` flow is unaffected. Billing
  shortcut icon appears in workspace manager for owners/admins.

- **Spaced-repetition flashcards** — new `flashcards` and `flashcard_reviews`
  tables, an SM-2 scheduler in `@notai/lib` (`scheduleNext()`), and a
  `/app/review` route with three tabs: Review (graded 0–5 with Again /
  Hard / Good / Easy buttons), All cards (list + delete), and New card
  (front/back form). Sidebar link "Review" added with the Brain icon.

- **FCM mobile push primitive** — `push_subscriptions` table now stores
  native mobile tokens alongside the existing web push rows. New
  `platform` column (`'web' | 'ios' | 'android'`, default `'web'`) and
  `device_id` column with a composite unique on
  `(user_id, device_id, platform)` so reinstalls update a device's
  token in place instead of accumulating stale rows. `registerPushSubscription`
  server action accepts the new shape; `/api/cron/push-daily-review`
  branches on platform and sends through the new `sendFcm()` helper
  (`apps/web/src/server/push/fcm.ts`, built on `firebase-admin`).
  New env: `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`.
  Migration `0028_push_subscriptions_fcm`.

- **Outbound webhook retry queue (BullMQ + Redis)** — `dispatchNoteEvent`
  now enqueues per-endpoint deliveries onto a `webhook-deliveries` queue
  instead of firing inline `Promise.all(fetch)`. Five attempts with
  exponential backoff (2s → 4s → 8s → 16s → 32s); every attempt writes
  a `webhook_deliveries` row so the dashboard delivery log shows the
  full retry history. New `/api/cron/webhook-worker` route runs every
  minute and drains the queue for ~50s. New required env `REDIS_URL`
  (Upstash Redis works: `rediss://default:<token>@<host>:<port>`) —
  the producer throws if it's unset, since silent fallback to inline
  delivery would re-introduce the silent-drop bug this is fixing.

- **Three new AI actions** — `outline`, `title`, and `fix-spelling`
  added to both the inline `/api/ai/slash` endpoint (so any consumer
  using `runSlashAi` gets them) and the note-level `<NoteAiMenu />`
  dropdown. `outline` produces a 2-level nested bullet list, `title`
  emits exactly one Title-Case suggestion (3–8 words), and
  `fix-spelling` is a strict grammar/spelling pass that preserves
  wording, tone, and Markdown structure.

- **Public share password gate** — `/p/<token>` now shows an unlock
  form when the owner has set a per-note password (existing
  `notes.passwordHash` column, scrypt format). Correct password sets
  an httpOnly cookie scoped to `/p/<token>` for 7 days. Uses the same
  hash format as the in-app `unlockNote` flow so a single password
  protects both surfaces.

- **Daily-digest in-app notification** — new hourly cron at
  `/api/cron/daily-digest` (Vercel schedule `20 * * * *`) inserts a
  single `daily_digest` notification per user per day at user-local
  08:00\u201310:00, summarising notes edited and created in the previous
  24h. Migration `0027_notification_kind_daily_digest` extends the
  `notification_kind` enum. Email channel is opt-in and deferred.

- **SLSA build provenance + SBOM on the realtime image** — the
  `release-realtime` workflow now passes `provenance: mode=max` and
  `sbom: true` to `docker/build-push-action`, producing in-toto
  attestations attached to the image manifest in Artifact Registry.

- **Unit tests for note-password hashing** — extracted
  `hashNotePassword` / `verifyNotePassword` to `apps/web/src/lib/note-password.ts`
  (shared by the in-app lock and the public-share gate). Covered by
  Vitest specs for happy-path, wrong password, salt uniqueness, malformed
  input, and Unicode passwords.

- **Desktop updater operator docs** — the Tauri 2 updater pipeline is
  already fully wired (sign on build, embedded pubkey,
  `latest.json` published per release). New `docs/desktop-updater.md`
  documents the one-time keypair setup, GH Actions secrets, key
  rotation, and troubleshooting. New `apps/desktop/scripts/generate-updater-key.ps1`
  wraps `pnpm tauri signer generate` and prints the values needed for
  `gh secret set`. No code change required to ship updates — bump
  `apps/desktop/package.json` version and merge.

- **i18n scaffold (English + Romanian)** — `next-intl` wired into the
  app with cookie-based locale (`notai_locale`, no URL restructure).
  Resolves user → cookie → `Accept-Language` → `en`. Messages in
  `apps/web/messages/en.json` + `ro.json`. Sign-in page is fully
  translated and a new "Language" section appears in
  `/app/settings/security`. Adding more locales is a copy-paste + entry
  in `SUPPORTED_LOCALES`. See `docs/i18n.md`.

- **TOTP two-factor auth (authenticator app)** — new `user_totp` table
  (migration 0026) and `/app/settings/security` section to enroll an
  authenticator app via QR code (Google Authenticator, 1Password,
  Bitwarden, etc). Generates 10 single-use recovery codes (sha256
  hashed, shown once on enrollment). Step-up auth: when TOTP is enabled,
  scheduling account deletion now requires a fresh code (5-minute
  freshness window). Powered by `otplib` + `qrcode`.

- **a11y CI** — new `.github/workflows/a11y.yml` runs Playwright with
  `@axe-core/playwright` against `/`, `/pricing`, `/faq`,
  `/privacy-policy`, `/terms`, `/signin` on every PR that touches the
  web app or shared UI. Fails on serious / critical WCAG 2.1 AA
  violations (color contrast tolerated for now). Local run: `pnpm
  --filter @notai/web e2e`.
- **GDPR audit doc** — new `docs/gdpr-audit.md` lists every personal
  data field, sub-processor, cookie, and how each user right is
  satisfied. Includes the open-follow-ups list (DPA template, SAR
  runbook, regional routing, pen-test cadence).

### Changed

- **Cookie consent v2 — analytics actually gated** — Sentry replay /
  traces and PostHog autocapture now wait for analytics consent before
  initialising, and re-init when the user grants consent later via the
  banner. Essential cookies (Auth.js session, Stripe Checkout fraud,
  consent record itself) remain always-on. No analytics cookies are set
  for visitors who reject the banner.

- **Nightly Postgres backups** — new
  `.github/workflows/db-backup-nightly.yml` runs `pg_dump --format=custom`
  every day at 02:30 UTC against `DATABASE_URL_PRODUCTION`, uploads
  the dump as a 30-day workflow artifact (with SHA-256), and
  optionally pushes it to `gs://$GCS_BACKUP_BUCKET/notai/<YYYY>/<MM>/<DD>/`
  when `GCP_SA_KEY` + `GCS_BACKUP_BUCKET` secrets are set. Uses the
  PGDG repo's matching `postgresql-client-17` so the dump catalog
  version always matches the server. Pairs with new
  `scripts/restore-backup.mjs` (live-streamed `pg_restore`, requires
  typing the literal "restore" for production targets, supports
  `--clean`, `--schema-only`, `--data-only`). Setup + verification
  flow documented in `docs/backups.md`.

- **Resend bounce/complaint webhook + email suppression list** —
  new `POST /api/webhooks/resend` verifies Svix signatures
  (`svix-id` / `svix-timestamp` / `svix-signature: v1,…`) with a 5 min
  replay tolerance and records hard bounces and spam complaints into a
  new `email_suppressions` table (migration `0024`). `sendEmail()`
  now consults the table on every send and short-circuits suppressed
  recipients. One-click unsubscribe lives at
  `/unsubscribe?token=<hmac>` (HMAC-signed email payload). Gated by
  `RESEND_WEBHOOK_SECRET` — route returns 503 when the env var is
  unset so dev/CI never accept unsigned webhooks.

- **Pre-push live progress** — `scripts/pre-push.mjs` now redraws each
  step with elapsed seconds and the most recent log line every second,
  so the multi-minute build no longer looks frozen. Set
  `$env:PREPUSH_VERBOSE=1` (or pass `--verbose`) to stream full step
  output via `stdio: 'inherit'`.

- **Passkeys (WebAuthn) sign-in + enrollment** — new
  `/app/settings/security` page lists registered passkeys and enrolls
  new ones (Touch ID, Face ID, Windows Hello, hardware keys). Sign-in
  page grows a "Sign in with a passkey" button that uses discoverable
  credentials so the authenticator picks the account. Built on
  `@simplewebauthn/server` v13 with HTTP-only single-use challenge
  cookies (5 min TTL) and counter-regression detection. After verify
  the route creates a real Auth.js v5 database session row and sets
  the session cookie directly. RP id/origin resolved from
  `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` (falls back to
  `NEXTAUTH_URL`). Schema: migration `0023_webauthn`
  (`webauthn_credentials` table).

- **Bulk export at `GET /api/v1/export`** \u2014 streams every non-trashed
  note as newline-delimited JSON with frontmatter (title, icon,
  folder, pinned, createdAt/updatedAt) + plaintext body. Records are
  shaped `{ path, content }` so the existing markdown importer can
  round-trip a dump back into another Notai instance. Settings page
  now exposes a one-click "Download .ndjson" button next to the
  importer.
- **Webhook redelivery + replay protection**. Outgoing webhook
  deliveries now sign `${unixSeconds}.${body}` with HMAC-SHA256 and
  include both `X-Notai-Timestamp` and `X-Notai-Signature: t=…,v1=…`
  (Stripe-style). Receivers should reject deliveries whose timestamp
  drifts more than ~5 min from their clock to prevent replay. The
  webhook settings page now expands each row to show the last 50
  deliveries with status + timing, and exposes a per-delivery
  "Resend" button backed by a new `redeliverWebhook(deliveryId)`
  server action.
- **Public API status page** at `/developers/status` \u2014 24h totals,
  error rate, average + p95 latency, a 7-day daily traffic chart, and
  a top-routes table. Reads aggregated metrics only from
  `api_request_log`; no per-key data is exposed. Page revalidates
  every 60 s.
- **Pre-push secret scanner** \u2014 new `scripts/secret-scan.mjs` greps
  every tracked file for known secret patterns (AWS, GitHub PAT/OAuth,
  Stripe, Slack, Google OAuth, OpenAI, Anthropic, private-key blocks)
  and fails the push when anything matches. False positives can be
  silenced with a `// notai-secret-scan-ignore` line comment or by
  appending the file to `ALLOW_FILES`.

### Added

- **Distributed rate limiter** \u2014 the in-memory limiter now upgrades
  to Upstash Redis via REST when `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` are set. Counters are shared across all
  Vercel instances; an INCR + EXPIRE-NX + PTTL pipeline runs in one
  HTTP round-trip with an 800 ms hard timeout, and any failure
  silently falls back to the per-instance memory bucket so an Upstash
  outage cannot take the API down.
- **Bundle analyzer** \u2014 `pnpm --filter @notai/web analyze` now runs
  `next build` with `@next/bundle-analyzer` enabled (gated by
  `ANALYZE=true`), producing the standard interactive treemap reports
  for the client/server/edge bundles.

### Fixed

- **CSP for Scalar API reference** \u2014 the new
  `/developers/api/reference` page loads its bundle from
  `cdn.jsdelivr.net`; that host is now whitelisted in `script-src` so
  the interactive docs render under the production CSP.

### Added

- **Per-API-key rate limiting on the v1 REST API** — every
  `/api/v1/notes/*` route now enforces 60 reads/min and 30 writes/min
  per key (in-memory sliding window). Exceeding either returns
  `429 too_many_requests` with `Retry-After`, `X-RateLimit-Remaining`
  and `X-RateLimit-Reset` headers. Limits and the 429 response shape
  are documented in the OpenAPI spec.

- **Public OpenAPI 3.1 spec + interactive reference** — the v1 REST
  surface (`/api/v1/notes`) is now described by a hand-maintained
  OpenAPI document served at `/api/v1/openapi` (cached 5 min,
  CORS-open). A new `/developers/api/reference` page renders an
  interactive try-it-yourself UI via Scalar API Reference, and the
  existing `/developers/api` docs page links to both. Spec covers
  all five operations (list, create, get, update, archive) with
  bearer scopes documented per-endpoint.

- **Per-API-key usage analytics** — every call to `/api/v1/notes/*`
  is now logged to a new `api_request_log` table (path, method,
  status, duration). The API key manager grows an inline activity
  panel: total requests in the last 30 days, error count, and the
  last 25 calls with status/method/path/latency. Logging is
  fire-and-forget and never affects the API response. Schema:
  migration `0022_api_request_log`.

### Added

- **Right-click "Comment on element"** in the canvas editor — when
  exactly one Excalidraw element is selected, right-click now opens
  the comments panel anchored to that element's id (uses the existing
  `onCommentBlock` hook, which was previously stubbed). Falls through
  to Excalidraw's native menu when no callback is wired or selection
  is empty/multi.

### Fixed

- **Comments schema integrity** — migration `0021_comments_fix`
  restores the canonical `note_comments` shape (with `user_id`,
  `anchor` jsonb, `resolved_at`) and `note_comment_mentions` table
  after `0020_comments` inadvertently overwrote them with a
  conflicting layout. Production DBs that have not yet applied 0020
  will get both files in sequence and end up correct.

### Added

- **Outgoing webhooks for note events** — register `https://` endpoints
  at `/app/settings/webhooks` to receive POSTed JSON when notes are
  created/updated/archived via the REST API. Each delivery is signed
  with HMAC-SHA256 (`X-Notai-Signature: sha256=<hex>`) using a
  per-endpoint `whsec_…` secret shown once at creation time. Failures
  bump a `failure_count`; per-attempt status codes are persisted in
  `webhook_deliveries` for debugging. Schema: migration `0019_webhooks`.
- **`@notai/sdk` npm publish workflow** — `.github/workflows/release-sdk.yml`
  publishes on `sdk-v*` tags (or manual dispatch) with provenance.
  Requires `NPM_TOKEN` repo secret. SDK now ships a real `dist/`
  build via `tsconfig.build.json` so consumers don't need TS source.
- **`@notai/sdk` TypeScript client** — new workspace package wrapping
  the public REST API. Bring your own `apiKey` + optional `baseUrl`
  for self-hosted deployments. Throws `NotaiApiError` with HTTP status
  + server message on non-2xx. Lives in `packages/sdk/`.
- **Capacitor deep-link bridge** — `<CapacitorDeepLinkBridge>` mounted
  in the root layout listens for native `appUrlOpen` events and
  routes `notai://...` deep links (from the iOS Action Extension)
  through the Next.js router. No-op outside Capacitor.
- **VAPID key generator + push docs** — `scripts/generate-vapid-keys.mjs`
  spits out the four env lines needed to enable web push. Full setup
  walkthrough at `docs/push-notifications.md`.
- **Android Play Store release pipeline** —
  `.github/workflows/release-mobile-android.yml` decodes the keystore,
  builds + signs the AAB, uploads to Play (defaults to the `internal`
  track, choosable via workflow_dispatch). Lists every required secret
  in the file header.
- **iOS share-sheet runbook** — added a complete Action Extension
  walkthrough to `apps/mobile/IOS_SETUP.md` (Swift snippets, Info.plist
  keys, URL scheme registration) so the mobile share sheet can hand
  text to Notai once the Mac bootstrap is run.
- **Daily review push notifications** — new
  `/api/cron/push-daily-review` route uses `web-push` (VAPID) to fan
  out a personalized morning nudge to every active subscription;
  registered as a Vercel cron at 13:00 UTC daily and prunes 404/410
  endpoints automatically. Requires `VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` env (no-op when unset).
- **Android share-sheet receive** — `AndroidManifest.xml` now declares
  an `ACTION_SEND text/plain` intent filter and `MainActivity.java`
  rewrites the incoming share into a deep link
  (`/app/quick-capture?shared=...`). The quick-capture page reads the
  param and pre-fills the new sticky.
- **Developer API docs** — public docs at `/developers/api` cover
  authentication, every endpoint shape, error codes, and a curl
  example. Linked from Settings \u2192 API keys.
- **Public REST API + API keys** — new `/api/v1/notes` (GET list,
  POST create) and `/api/v1/notes/[id]` (GET, PATCH, DELETE\u2192archive)
  endpoints authenticate via `Authorization: Bearer nk_\u2026` tokens.
  Keys are SHA-256-hashed with only a 12-char prefix shown afterwards.
  UI lives at `/app/settings/api-keys` and supports create + revoke;
  scope strings (`notes:read notes:write`) are checked per request.
  Backed by migration `0018_api_and_push`.
- **Web push notifications scaffolding** — `/sw-push.js` service
  worker handles `push` and `notificationclick` events; client toggle
  at `/app/settings/notifications` requests permission, subscribes via
  PushManager (using `NEXT_PUBLIC_VAPID_PUBLIC_KEY`), and persists the
  subscription server-side. The actual cron-triggered send runs in a
  follow-up; the receive path is fully wired.
- **Markdown / Obsidian / Notion importer** — new `/app/settings/import`
  page with a folder picker (`webkitdirectory`). Each `.md`/`.markdown`/
  `.txt` file becomes a note; YAML frontmatter (`title`, `icon`, `emoji`)
  is honored, with the first H1 used as a fallback title. Caps: 1 MiB
  per file, 200 files per batch (chunked client-side). Lives in
  `apps/web/src/server/actions/import-markdown.ts` and
  `apps/web/src/components/settings/markdown-import-button.tsx`.
- **iOS TestFlight release pipeline** — `.github/workflows/release-mobile-ios.yml`
  builds + signs + uploads to TestFlight on `mobile-ios-v*` tags or
  manual dispatch. Documents every required secret (cert, profile,
  App Store Connect API key) and runs on `macos-14` so the repo stays
  Windows-friendly day-to-day.
- **Social share buttons on public links** — when a note's public read-only
  link is enabled, the share dialog now shows X, LinkedIn, and email
  share affordances next to the copy-link control.
- **Workspace teams (end-to-end)** — new server actions in
  `apps/web/src/server/actions/workspaces.ts` cover create / delete,
  invite (signed token, 14-day TTL), accept, member listing &
  removal, and folder sharing with role gating
  (`owner`/`admin`/`editor`/`viewer`). Backed by migration `0017`. UI
  lives at `/app/workspaces` with a per-workspace member panel; the
  invite flow lands at `/workspace/accept/[token]` and requires the
  signed-in email to match the invitee.
- **Mobile haptics + safe-area** — tiny `lib/haptics.ts` wrapper uses
  the Web Vibration API and emits a `notai:haptic` event so a
  Capacitor plugin shim can hook in later. Wired into the mobile FAB
  (light/medium) and voice-capture save (success). Root viewport now
  sets `viewportFit: 'cover'` so iOS notch insets work as expected.
- **Continue where you left off** — new `<ContinueCard>` on the
  dashboard surfaces the 5 most recently opened notes from any device
  using the existing `notes.lastOpenedAt` mirror. Powered by
  `listRecentlyOpened` in `server/actions/recent.ts`.
- **Inline link previews in notes** — `<NoteLinkPreviews>` scans the
  note's plaintext mirror, dedupes URLs (cap 6), and renders a
  Notion-style card per link via the existing cached
  `/api/link-preview` endpoint. Mounted under the canvas next to the
  backlinks panel.

### Earlier in this release window

- **iOS setup runbook** — `apps/mobile/IOS_SETUP.md` documents the full
  Xcode-based path: `cap add ios`, signing, Privacy Manifest template,
  Info.plist usage strings, and TestFlight upload. Repo stays
  Windows-friendly; no `apps/mobile/ios/` checked in until a Mac runs
  the bootstrap.
- **Realtime presence cursors** — `<CanvasNote>` now publishes the
  local pointer to Yjs awareness (~30 fps) and reflects peer cursors
  via Excalidraw's `collaborators` map, giving live multi-user cursors
  on shared notes.
- **Word (.doc) export** — new `exportNoteDoc` server action +
  sidebar context menu item ship a Word-openable HTML wrapper, joining
  the existing Markdown / PDF exports.
- **Smart link previews** — `/api/link-preview` resolves OpenGraph
  metadata server-side (4 s timeout, 256 KiB cap, SSRF-blocklisted),
  consumed by a new `<LinkPreviewCard>` for Notion-style inline cards.
- **Encryption-at-rest helper** — `apps/web/src/server/crypto/encryption.ts`
  provides AES-256-GCM `encrypt` / `decrypt` plus key-wrap helpers
  driven by `NOTAI_DATA_KEY`. Foundation for opt-in note-body
  encryption (no schema changes yet).
- **Workspaces + shared folders schema** — migration
  `0017_workspaces` adds `workspaces`, `workspace_members`,
  `shared_folders`, and `workspace_invites` tables with a
  `workspace_role` enum. Already applied to local; production
  migration pending.
- **Web Clipper v0.4.0** — bumped manifest version to mark a release
  cycle (article + selection + region screenshot pipelines stable).
- **Privacy-first analytics consent** — landing page now shows a
  cookie-banner that, on accept, sends pageviews + custom events to
  PostHog via a tiny dependency-free client (`NEXT_PUBLIC_POSTHOG_KEY`
  + `NEXT_PUBLIC_POSTHOG_HOST`). — No-ops without keys.

- **Android release signing scaffold** — `apps/mobile/android/app/build.gradle`
  now wires a `signingConfigs.release` block driven by Gradle properties
  (`NOTAI_KEYSTORE_FILE`, `NOTAI_KEYSTORE_PASSWORD`, `NOTAI_KEY_ALIAS`,
  `NOTAI_KEY_PASSWORD`) so debug builds keep working unchanged. Full
  keystore generation + AAB build instructions live in
  `apps/mobile/android/SIGNING.md`. `.gitignore` now excludes
  `keystore.properties` so secrets stay local.
- **Saved searches** — command palette can save the current query +
  filter pills (semantic, pinned, favorites, stickies) under a name and
  restore them in one click. Reuses the `user_views` table with
  `scope='search'`, no migration required. Server actions live in
  `apps/web/src/server/actions/saved-searches.ts`.
- **Custom share slugs** — public share dialog accepts a per-note
  slug so readers see `/p/my-talk` instead of an opaque token. Backed
  by migration `0016_share_slug_password` (partial unique index on
  `(owner_id, public_share_slug)`); `getPublicShare` now resolves
  either token or slug.
- **Per-note password lock** — owners can set a scrypt-hashed password
  on any note. Locked notes show a `<NotePasswordGate>` until unlocked
  for the session via an httpOnly cookie (4 h TTL). Includes
  `setNotePassword`, `clearNotePassword`, `unlockNote`, and a Set/Clear
  control inside the share dialog.
- **Marketing landing testimonials** — added a 3-card social-proof
  section between Use Cases and Final CTA.
- **Mobile voice FAB** — the mobile capture stack now exposes a mic
  button alongside the `+` so voice-to-note (already wired to Whisper
  via `createNoteFromVoice`) is one tap away on phones.
- **Stats dashboard** — new `/app/stats` page showing total / 7-day /
  30-day note counts, a 30-day daily activity bar chart, top 12 tags,
  and favourite/archived totals. All aggregated server-side via a
  single Postgres round-trip per section.

- **Android debug APK** — `cap add android` ran successfully and
  `:app:assembleDebug` produces a 3.6 MB sideloadable APK at
  `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
  Builds with the JBR shipped by Android Studio (JDK 17).
- **Play Store scaffold** — added `store/play/screenshots/README.md`
  with capture script and `store/play/privacy.md`. Listing URLs now
  point at the existing `/privacy-policy` and `/terms` pages.
- **AI command palette** — `⌘K` now shows a "Current note (AI)" group
  when you're inside `/app/n/<id>`: summarise, extract action items,
  rewrite for clarity, suggest tags. Results land on the clipboard so
  the canvas is never modified without consent.
- **Mini graph per note** — 1-hop neighbourhood (in + out backlinks)
  rendered as an SVG inside the note workspace, alongside the
  existing backlinks panel and related-notes rail.
- **Daily journal template** — fresh daily notes are seeded with
  Top three / Notes / End-of-day sections so the page is never blank.
- **Inbox-Zero nudge** — dashboard card appears once you have ≥ 5
  unfiled notes; one click into the existing Inbox Zero flow.
- **Public share OG image + metadata** — `/p/<token>` pages now ship
  Open Graph + Twitter card metadata and a `next/og`-rendered preview
  image so Slack / Discord / iMessage previews look intentional.
- **Hybrid search** — new `searchNotesHybrid` server action merges the
  trigram lexical pass with a pgvector semantic pass; behind a
  ✨ Semantic pill in the command palette so the default stays fast.
- **Recurrence engine** — `@repeat(daily|weekly|monthly|weekdays)` tasks
  now auto-roll: when you check one off, an amber banner offers to
  append a fresh open task with the next due date stamped in. Per-note,
  per-day dismissal so it stays quiet once you've decided.
- **iCal RRULE expansion** — calendar feeds with `RRULE:` (DAILY,
  WEEKLY+BYDAY, MONTHLY, YEARLY) and `EXDATE:` exceptions are now
  expanded into individual occurrences within the dashboard window.
  Caps at 365 instances per series for safety.
- **Email attachments → assets** — Postmark inbound payloads now upload
  PNG/JPEG/WEBP/GIF/SVG/PDF attachments (≤10 MB each, ≤10 per email)
  through the existing S3 SigV4 pipeline and link them on the created
  note.
- **Database / table view** — every property key you've used becomes a
  browsable database at `/app/db/[key]`. Table view shows the primary
  key column plus every other property on the same notes, sortable by
  any column.
- **Estimate-aware tasks** — `@est(15m)` / `@est(1h)` parses into a
  per-task minute count and renders a sky-blue badge in the Today card
  so time-blindness doesn't blow up your day.
- **Time-of-day chip** — ambient header chip shows the current segment
  (Morning / Afternoon / Evening / Night) and minutes until the next
  one, updating every minute.
- **Weekly review card** — dashboard surface listing the notes you
  touched in the last 7 days, with new-vs-touched counts.
- **Mobile capture FAB + PWA install prompt** — floating + button on
  small viewports opens Quick Capture; a polite install banner appears
  after 4 s with a 14-day cooldown on dismissals.
- **Mobile asset pipeline** — `apps/mobile` now ships a
  `@capacitor/assets` config plus a 1024² source icon for generating
  Android / iOS launcher icons and splash screens.
- **Vitest + CI green-gate** — `apps/web` now runs Vitest with a
  baseline test suite for `lib/tasks.ts`, and a new GitHub Actions `ci`
  workflow runs lint → typecheck → test → build on every push and PR.
- **Hierarchical tags** — `#projects/notai/launch` style. Tag detail
  pages now show breadcrumbs and child-segment chips with note counts;
  rolling up notes under a tag includes its descendants.
- **Cover images & typography presets** — Notion/Craft-style banner per
  note with drag-to-reposition; four editor type stacks (Serif, Sans,
  Rounded, Mono) selectable in Settings → Appearance.
- **Tasks with due dates & recurrence** — `[ ] @due(YYYY-MM-DD)
  @repeat(daily|weekly|monthly|weekdays) !!high|med|low`. Today /
  Overdue rollup card on the dashboard.
- **Notion ZIP & Evernote ENEX import** — added to Settings → Account.
  Notion's hex-suffix folder/file names are stripped; ENEX resources
  (attachments) are counted but skipped in this first cut.
- **OCR for uploaded images** — when you upload an image, the toast
  offers an "Extract text" action that calls a vision-capable OpenAI
  model (BYOK) and copies the result into the note.
- **Calendar ingestion via iCal** — paste a Google/Outlook/Apple iCal
  URL at `/app/calendars`; today + tomorrow events appear on the
  dashboard. Read-only; SSRF-hardened with private-IP rejection,
  request size cap, and an 8 s timeout.
- **Email-to-note** — each user gets a secret address
  `local+TOKEN@<EMAIL_INBOUND_DOMAIN>`. Inbound webhook at
  `POST /api/inbound-email` accepts a Postmark-shaped payload, gated
  by `EMAIL_INBOUND_WEBHOOK_SECRET`. Sender is verified against the
  user's account email. See `docs/email-inbound.md`.
- **Note properties** — Bear/Notion-style typed key/value fields
  (text/number/date/select/checkbox/url) attached to any note.
  Editable from a collapsible panel below the editor. Foundations laid
  for a future table/database view.
- **Mobile wrapper (`apps/mobile`)** — Capacitor 6 shell that loads the
  production web app inside Android + iOS native webviews. Includes
  Play Store and App Store listing templates plus a step-by-step
  publishing guide. PWA install path remains supported.

### Database

- New migrations: `0012_note_cover`, `0013_calendar_subscriptions`,
  `0014_email_aliases`, `0015_note_properties`. Run
  `pnpm db:push` (local) or apply via the migration script before the
  next deploy.

## [@notai/web 0.2.0] - 2026-05-10

### Added

- **Bulk archive in Inbox-Zero**: alongside the existing bulk Trash
  action, selected items can now be archived in one click via the
  sticky toolbar.
- **Quick filters in command palette**: \u2b50 Favorites and \ud83d\uddc2\ufe0f
  Stickies pills join the existing \ud83d\udccc Pinned filter, all
  combinable with the search query.
- **Word-level diff in version history**: when a deleted line is
  immediately followed by an added line, the diff view now shows
  word-level changes inside that pair instead of two separate
  red/green lines.
- **Hourly snapshot guarantee**: opening Version History now
  records a snapshot if the most recent one is more than an hour
  old, so quiet days never leave the timeline empty.

### Earlier in this release

- **Continue this thought (AI)**: a new option in the note AI menu
  takes the currently selected text element on the canvas (or the
  most recent one if nothing is selected) and asks the model to
  extend it by 1-3 sentences in the same voice. Result lands as a
  fresh text element below the source.

### Earlier in this release

- **Footnote rendering in reading mode**: Markdown-style `[^1]`
  citation markers and `[^1]: ...` definition lines on the canvas
  are auto-collected, renumbered in document order, and rendered as
  superscript anchors with an end-of-page footnotes list.
- **Save note as personal template**: any note can be saved as a
  private template via the sidebar context menu (More \u2192 Save as
  template\u2026). Personal templates appear on the gallery page next
  to official ones with a "Personal" badge and stay invisible to
  other users.
- **Mood heatmap on dashboard**: a 30-day grid coloured by a tiny
  keyword-bag sentiment over your own notes \u2014 no AI calls, no
  schema change, no data leaves your server.
- **Version history diff**: the snapshot panel now has a "Compare
  with current" toggle that renders an LCS line-level diff between
  the selected snapshot and the live note.

### Earlier in this release

- **Smart link previews (favicon-only)**: when a note's plaintext
  begins with `http(s)://...`, the workspace shows a compact chip
  next to the tag row containing the site's favicon (via Google's
  public S2 favicon service \u2014 no server-side fetching, no SSRF
  risk) and the hostname. Clicking the chip opens the URL.

### Earlier in this release

- **Per-folder default tags**: every folder now carries a
  `default_tag_ids` list (migration `0011_folder_default_tags`).
  A new "Default tags\u2026" item in the folder context menu opens a
  multi-select dialog; any note created inside the folder thereafter
  is auto-tagged on insert (best-effort, never blocks creation).
- **Daily journal prompt history**: the dashboard prompt card now
  remembers the last 30 prompts you've seen in `localStorage`. A
  small "History" button next to the refresh icon lists them \u2014
  picking one starts a fresh note seeded with that prompt.

### Earlier in this release

- **Public read-only share link**: each note can now expose itself
  as a public, unauthenticated read-only page at `/p/{token}`.
  A new section in the Share dialog toggles the link, copies the
  URL, and shows the expiry. Backed by migration `0010_public_share`,
  which adds `public_share_token` (unique) and
  `public_share_expires_at` to `notes`. Tokens are 144-bit URL-safe
  random; expired or disabled tokens 404.

### Earlier in this release

- **End-of-day review**: a new `Mod+Shift+R` shortcut (or any caller
  dispatching `notai:daily-review`) opens an AI-composed wrap-up of
  every note touched today, with a list of those notes for quick
  re-entry.
- **Custom keyboard shortcuts**: a new Settings → Shortcuts section
  lets you remap the five built-in hotkeys (command palette, quick
  capture, daily note, pin/unpin, end-of-day review). Overrides
  persist in `localStorage` and the underlying `useHotkey` hook
  re-binds live, no reload required.
- **Bulk select in Inbox-Zero**: every unfiled row now has a
  checkbox; a sticky toolbar appears with "Select all", "Clear",
  and "Move to Trash" actions for rapid inbox cleanup.

### Earlier in this release

- **Note merge undo**: the success toast after merging a note now has
  an Undo button (8s window) that restores the soft-deleted source
  via `restoreNote`. The appended text in the target stays put —
  only the source comes back.
- **Reading-time goal**: each note's Read button now tracks daily
  reading-mode time in `localStorage` (per-day key) and shows a
  sparkle when you cross 10 minutes for the day.
- **Workspace search filter — Pinned only**: a small toggle pill in
  the command palette restricts results to pinned notes; resets when
  the palette closes.
- **Keyboard nav polish**: a second skip-link ("Skip to sidebar")
  joins the existing "Skip to content" link, and the sidebar `<aside>`
  is now a proper jump target with `id="app-sidebar"` + `tabIndex={-1}`.
- **PWA share target**: a dedicated `/share` route now backs the
  Web Share API entry in `manifest.webmanifest` — picking Notai from
  an OS share sheet creates a new note with the title/text/url
  pre-filled and lands you in it.

### Earlier in this release

- **Word-count chip**: a tiny `123 words · 1 min read` indicator next
  to the tag chips in every note, recalculated live from the canvas
  contents (220 wpm reading speed).
- **Pin keyboard shortcut**: `Mod+Shift+P` toggles the pinned state of
  the current note, mirroring the visible pin button and surfacing a
  quick toast.
- **Sidebar density**: a new Appearance preference (Compact / Cozy /
  Spacious) that drives the row padding and font size of notes in the
  sidebar via CSS variables. Persists per browser like the other
  appearance prefs.
- **Note color labels**: every note can now carry a soft tint
  (`amber`, `rose`, `sky`, `emerald`, `violet`, `slate`, or none),
  picked from a small popover next to the title. The chosen color
  shows up as a dot in the sidebar tree so you can scan a folder at
  a glance.
- **Auto-tag suggestions**: when a note has no tags and stays open
  for ~30 seconds, the tag chip row quietly fetches up to three
  AI-suggested tags. Each suggestion is one click to accept; we only
  do this once per note per session so it never feels spammy.

### Earlier in this release

- **Copy as Markdown**: a new context-menu item under each note\u2019s
  Export submenu that copies the rendered Markdown straight to the
  clipboard \u2014 same content as the .md export, just paste-ready.
- **Pomodoro timer**: a small pill in the bottom-left corner expands
  into a 25/5/15 focus timer with phase auto-advance, cycle counter,
  and a brief Web-Audio beep when a phase ends. State persists in
  `localStorage` so the timer keeps counting across navigations and
  refreshes \u2014 we only re-render locally; the deadline lives in
  `endsAt`.
- **Calendar export (.ics)**: Settings \u2192 Account scans every active
  note for `YYYY-MM-DD` (optionally `T HH:MM`) dates and emits a
  RFC 5545 .ics file. Subscribe to it from Apple/Google/Outlook
  Calendar to see your notes\u2019 dates inline.
- **Note merge**: right-click a sidebar note \u2192 \u201cMerge into\u2026\u201d. Pick
  a target via the same trigram search the palette uses; the source
  note is appended (with a \u201c--- Merged from \u2026 ---\u201d divider) and
  soft-deleted, the target opens with the body queued in the existing
  `notai:pending-append` handoff.

### Skipped

- Note templates \u2014 already shipped via the DB-backed Apply-Template
  button (uses `listTemplates` + `applyTemplateToNote` with optional
  AI fill), no new local-template menu needed.

### Earlier in this release

- **Rich previews in command palette**: hovering or arrowing onto a
  search hit reveals a fuller plaintext snippet (~600 chars centred on
  the match) right below the result list. The match is still
  highlighted; navigation works exactly as before.
- **Auto-emoji for note titles**: when a note has no icon yet and the
  user types a title at least 4 characters long, Notai quietly asks
  the AI to suggest a single emoji and saves it as the note icon. One
  AI call per unique title; cached locally so re-typing the same
  title doesn\u2019t re-fire.
- **Snippets (`::name`)**: type `::todo`, `::sig`, `::today` etc. on
  the canvas and Notai expands the token in place. Snippets are
  managed in Settings \u2192 Snippets and stored in `localStorage` so they
  load instantly without a server round-trip. `__TODAY__` and
  `__NOW__` placeholders inside a snippet body are evaluated at
  expansion time.
- **Sticky-from-selection**: select two or more text elements on a
  canvas and a small \u201cNew note from selection\u201d button appears in the
  bottom-right corner. Clicking it spins up a fresh note pre-filled
  with the joined text (sorted top-to-bottom) using the same handoff
  the global Quick-Capture overlay already uses.
- **Workspace import (.zip)**: Settings \u2192 Account now offers \u201cImport
  .zip\u201d \u2014 drop the export from any Markdown-based tool and Notai
  recreates one note per `.md` file, mirroring the folder structure.
  Limits: 500 files, 1 MB per file, 5 MB total uncompressed.

### Skipped

- Mind-map mode toggle \u2014 already covered by the existing AI menu\u2019s
  \u201cBuild mind map\u201d (which uses `insertMindMap` to render a radial
  layout right onto the canvas, with regenerate-on-confirm).

### Earlier in this release

- **Reading mode**: a Read button next to the note title swaps the
  canvas for a clean, scrollable typed page \u2014 every text element on
  the canvas, sorted by `y`, rendered with prose typography. Esc to
  exit. Heading levels (h1\u2013h3) are honoured via `customData.style`.
- **Bookmarklet**: Settings \u2192 Integrations now ships a draggable
  "Clip to Notai" bookmarklet that opens `/clip?url=...&title=...&selection=...`
  and creates a fresh note from the active page (URL + selected text).
  Cookie-auth, no PAT required.
- **Smart Inbox AI gist**: Inbox-Zero gains an "AI gist for each"
  button that batches up to 12 unfiled notes into one streamChat call
  and shows a one-line summary under each item. Falls back to a
  smart-truncated first line when the AI is unavailable.
- **Quick math on canvas**: type any arithmetic expression ending in
  `=` (e.g. `2*pi*5=`, `sqrt(144)=`) and Notai rewrites the text
  element to `expr = result` automatically. Safe whitelist evaluator
  \u2014 no `eval()` access to globals, no network access.
- **Note locking (PIN)**: a small lock chip in the title row gates a
  note behind a SHA-256-hashed PIN stored in `localStorage`. Casual
  shoulder-surfing protection only; not a replacement for end-to-end
  encryption.

### Skipped

- Pin-to-home (already covered by the existing "Pin on Today").

### Deferred (still gated on Excalidraw text-edit hooks or DB work)

- Sticky-from-selection, public share link, note revisions, audio
  attachments, inline AI ghost-text, mind-map mode toggle, snippets
  expansion, sentiment heatmap, quick-jump rich previews, per-folder
  default tags.

### Earlier in this release

- **Find in note (\u2318F)**: in-canvas search overlay that lists every text
  element matching the query; click a hit to scroll-to + select it.
- **Onboarding tour**: 5-step welcome overlay shown to first-time users
  with `mod+shift+n` / `mod+j` / `mod+k` shortcut hints. Persisted via
  `notai:onboarding:completed-v1` in localStorage.
- **Account export as Markdown .zip**: Settings \u2192 Account now offers a
  "Download .zip" option that streams every owned note into a folder-
  mirrored archive (one `.md` per note + a top-level README). Built
  in-memory with `fflate`, base64-piped to the browser.
- **Trash auto-purge nudge**: dashboard card surfaces how many trashed
  notes are past the 30-day retention window and offers one-click
  permanent delete; dismissal is sticky for the rest of the day.
- **Embed worker status pill**: a small spinning chip in the sidebar
  header appears whenever the embedding worker is behind on the user\u2019s
  notes, so it\u2019s obvious why Related-notes / Ask might be incomplete.
  Polls every 30s while pending, then stops.
- **Dyslexia-friendly font + High-contrast** toggles in Settings \u2192
  Appearance. Driven by `data-dyslexia-font` / `data-high-contrast`
  attributes on `<html>` and pure-CSS rules in `globals.css`.
- **Grouped notifications**: the bell tray now collapses runs of
  notifications targeting the same note + same kind into a single
  entry ("Alex and 3 others mentioned you"). Marking the group as read
  marks every member.

### Skipped (already shipped earlier)

- Pin notes to home (the existing "Pin on Today" already does this).

### Deferred

- Sticky-from-selection (needs Excalidraw selection observer +
  floating toolbar).
- Public share link with read-only view (DB migration required).
- Note revisions / time travel (Y.Doc history viewer).
- Audio attachments (storage + DB schema work).
- Inline AI ghost-text suggestions, mind-map mode toggle, snippets
  expansion (still gated on Excalidraw text-edit hooks).

### Earlier in this release

- **Today\u2019s daily note hotkey**: \u2318/Ctrl+J anywhere in the app jumps to
  (or creates) the canonical daily note for the user\u2019s timezone.
  Mirrored as a "Today\u2019s daily note" entry in the command palette.
  Mirrored as a "Today\u2019s daily note" entry in the command palette.
- **Tag pages** at `/app/tags/[name]`: each tag chip now links to a
  list of every note carrying that tag, sorted by recency. Mirror
  surface to the existing sidebar tag filter; works with deep-links.
- **Open loops** dashboard card: rolls up every unchecked `[ ] \u2026`
  TODO from recently touched notes (max 10, max 3 per note) so the
  loose threads sit in one scannable place.
- **Sticky window \u2192 \"Open in main app\"** button: opens the same note
  in the main editor window. On Tauri it asks the host to focus the
  main window via `open_in_main`; in the browser it just spawns a new
  tab.
- **Auto-archive nudge**: dashboard card shows the count of notes
  untouched for 90+ days and offers a one-click bulk archive (with an
  Undo toast that restores everything).
- **Related notes rail** under every note: pgvector cosine similarity
  over `notes.embedding` surfaces up to 6 semantic neighbours
  (distance \u2264 0.45). Hidden when the embed worker hasn\u2019t caught up
  on a fresh note.
- **Ask answers history**: the Ask page persists the last 10 asked
  questions to localStorage and shows them as a "Recent questions"
  list in the empty state for quick re-running.
- **Folder icon picker**: right-click a folder in the sidebar to set
  one of 15 emoji icons (or clear it). Icon is rendered in place of
  the default folder glyph when set.
- **Print / Save as PDF**: new context-menu item next to "Export as
  Markdown" \u2014 spawns a hidden print frame with a clean serif layout
  and triggers `window.print()` so the browser\u2019s native PDF dialog
  does the actual rendering.
- **Voice mode \u2192 outline**: the canvas hold-to-record FAB now offers
  an "Outline" toast action when a transcript is 1\u2009000+ characters,
  feeding it through the same `outlinePastedText` action used for
  smart-paste.

### Skipped (already shipped earlier)

- Sticky note color picker (already in sticky-window).
- Drag-to-reorder folders (sidebar-tree already uses @dnd-kit).
- Quick Capture auto-suggest folder (already wired via
  `suggestQuickCaptureDestination`).
- Note templates (DB-backed `templates` table + `/app/templates`
  exists).

### Deferred

- Snippets `::name` expansion on canvas (needs Excalidraw text-edit
  hooks that aren\u2019t exposed publicly).
- Mind-map mode toggle for arbitrary selections (existing AI mind-map
  already covers tree generation).
- Inline AI ghost-text suggestions while typing on canvas (same
  Excalidraw text-edit hook gap as snippets).

### Earlier in this release

- **Note word-count + reading time** indicator next to the tag chips on
  every note. Reads text elements straight off the Y.Doc (so the count
  doesn't lag behind a server-side embed pass) and throttles to once a
  second. Hidden when the note is empty.
- **Two-step undo for Inbox Zero moves**: every "File here" toast now
  carries an "Undo" action that puts the note back into the unfiled
  pile (and re-inserts it at the top of the suggestion list).
- **Bulk auto-file in Inbox Zero**: a header pill lights up when one or
  more notes have a >=65% folder match. "File all" moves them in a
  single pass and surfaces a single "Undo all" toast.
- **Daily writing prompt** dashboard card: one short, curiosity-leaning
  prompt per UTC day, generated via the user's BYOK chat model and
  cached in localStorage so it sticks across reloads. "Write about
  this" creates a fresh note seeded with the prompt as its title.
  Falls back to a small rotating list when no AI provider is wired or
  the request fails.
- **Auto-tag suggestions** (Sparkles button next to the tag chip-input):
  asks the user's chat model for 1\u20133 short, lowercase tags and renders
  them as click-to-accept chips. Already-attached tags are filtered
  out of the suggestion list.
- **Smart bullet-list reorder**: \u2318/Ctrl+Shift+\u2191/\u2193 on a focused
  Excalidraw text element now swaps the current line with its
  neighbour \u2014 but only when both lines look like bullets, todos
  (`[ ]`/`[x]`), or numbered list items. Prose paragraphs keep the
  native arrow-key behaviour.
- **AI Daily Recap** dashboard card: 2\u20134 short bullets summarising
  what the user wrote today across up to 20 notes. Hidden on light
  writing days (<30 words) so the dashboard never shames a slow day.
  "Save as note" hands the body to the editor via the existing
  `notai:pending-append` channel.
- **Smart paste \u2192 outline**: pasting >=500 characters of plain text
  onto the canvas now pops a toast with a choice ("Outline" /
  "As-is"). The Outline path runs the user's chat model with a tight
  bullet-only system prompt and drops the result onto the scene. URL
  pastes still hit the existing summary-card path.
- **Keyboard shortcut cheatsheet** now includes a "Canvas" group
  documenting `F`/`Esc` focus mode, the bullet-reorder hotkey, and
  the hold-to-record FAB.
- **Calendar view** at `/app/calendar`: 6-row month grid with per-day
  note counts (Mon-first, UTC). Click a day to see the notes touched
  that day. Reachable from the command palette.

- **Per-paragraph source attribution in Ask answers**: every paragraph
  in an Ask response now renders a chip-row above it listing the
  unique notes cited within that paragraph (deduped, in citation
  order). Inline `[#n]` chips remain so a reader can scan which note
  backs each individual claim. Mirrored across the Cmd-K Ask dialog
  and the full `/app/ask` page so both surfaces look identical.
- **Stale TODO digest** on the dashboard: scans `notes.plaintext` for
  unchecked `[ ] …` lines in notes that haven't been touched in 14+
  days and surfaces up to 6 of them in a single card. ADHD-friendly:
  rediscovers things you meant to do but lost track of. One click
  jumps to the source note. Renders nothing when nothing is stale.
- **Random recall** Cmd-palette command: jumps to one note picked at
  random from the user's 30+-day-old archive. Reuses the same SQL as
  the dashboard Throwback card; no duplicate query path.
- **Note-level focus mode**: press `F` on the canvas with one or more
  elements selected to dim every other element to 20% opacity; press
  `Esc` (or `F` again) to restore. Implemented via a non-undoable
  `updateScene({ captureUpdate: 'NEVER' })` that swaps element
  opacities against a snapshot taken at toggle-on, so the dim/restore
  doesn't pollute the undo stack and an unmount automatically
  restores. A small "Focus mode" pill appears at the top of the
  canvas while active.
- **Writing streak badge** on the dashboard: shows the user's current
  consecutive-day writing streak (and best ever when it differs).
  Computed in SQL by walking distinct `date_trunc('day', updated_at)`
  values for the user's non-deleted notes. Hidden for first-day users
  who have no streak yet.
- **Hold-to-record voice on canvas**: a press-and-hold microphone FAB
  next to the Voice Mode button. Press → 300 ms arming delay (so a
  misclick is a no-op) → MediaRecorder starts; release → transcript
  drops at the current viewport center of the Excalidraw scene. Uses
  the existing `transcribeAudio` server action (BYOK + AI quota
  enforced) and the new `appendTextToScene({ at })` option that bypasses
  the "below the lowest element" placement heuristic when explicit
  world coordinates are provided.
- **Inbox Zero** (`/app/inbox-zero`): lists every unfiled note (up to
  50, newest first) and suggests the closest folder per note via
  pgvector cosine similarity against each folder's centroid (mean
  embedding of its existing notes). One-click "File here" accepts the
  suggestion; a chip-row of all folders lets you override. Surfaced
  from the Cmd palette as "Inbox Zero — file unfiled notes".

### Removed
  `text-block.tsx`, `toolbar.tsx`, `slash-menu-extension.ts`,
  `slash-menu-popover.tsx`, `backlink-extension.ts`, `backlink-popover.tsx`,
  `callout-extension.ts`, `toggle-extension.ts`, `math-extension.tsx`,
  `mermaid-extension.tsx`, `calc-extension.tsx`, and `ai-command-bar.tsx`.
  Pulled all 25 `@tiptap/*` packages from `packages/editor/package.json`
  and the orphaned `@tiptap/react` from `apps/web/package.json`. The
  Excalidraw scene is now the single source of truth for note content.
- **Phase 3 step 4 — block-layer writers retired**: `addBlock`,
  `updateBlockAt`, and `deleteBlockAt` removed from `migrate-doc.ts`
  and the `@notai/editor` public API. Read-side helpers
  (`peekBlocksArray`, `peekBlockFragment`, `getBlocksArray`,
  `getBlockFragment`, `extractAllPlaintext`) and `migrateLegacyDoc`
  remain so the one-shot legacy → Excalidraw drain in
  `migrate-blocks-to-excalidraw.ts` and the migration banner keep
  working for users who still have pre-canvas notes.
- Note workspace toolbar (`<Toolbar editor={editor} />`) and its
  `subscribeFocused` plumbing — the canvas has no focusable TipTap
  editor anymore, so the toolbar permanently rendered as `null`.

### Added — Throwback card on the dashboard

A small **Throwback** card now sits below the Morning Brief on
`/app`. It surfaces a random note you haven't touched in 30+ days, with
its icon, title, and a short snippet — one click jumps to the note,
and a refresh icon picks a different one without reloading. The card
silently renders nothing for users whose archive is too young (no
empty-state spam during the first month).

ADHD-friendly recall: the brain forgets, the app remembers, and a
casual "remember this?" nudge is far more effective than expecting
people to dig through their own archive.

- **`apps/web/src/server/actions/throwback.ts` (new)**:
  `getThrowbackNote()` returns a single `ThrowbackNote | null` from
  the user's owned, non-trashed notes whose `updatedAt` is older than
  30 days. Pulls up to 200 oldest candidates, picks one at random.
- **`apps/web/src/components/dashboard/throwback-card.tsx` (new)**:
  client component with a refresh button. `formatDaysAgo` helper
  rounds to days / months / years for human display.
- **`apps/web/src/app/app/page.tsx`**: mounted under
  `<MorningBriefCard />` in the dashboard header column.

### Added — Save Ask answers to a new note

Both the `/app/ask` full page and the global ⌘⇧K Ask dialog gain a
**Save to a new note** action that fires once the streamed answer
completes. Click it and Notai creates a fresh note titled with the
question, drops the full answer (citation chips intact) plus a
**Sources** list onto the canvas via the existing
`notai:pending-append` handoff, and routes you to the new note.

This turns Ask from a transient lookup into a durable artefact: a
research session you ran on Tuesday becomes a saved, searchable,
linkable note on Wednesday — with the citations that backed every
claim still inline.

- **`apps/web/src/components/ask/ask-client.tsx`**: new local
  `SaveAnswerButton` rendered alongside the existing `CopyButton`.
  Shares the same body format as the dialog flow.
- **`apps/web/src/components/layout/ask-dialog.tsx`**: imports
  `createNote`, adds a `saveAnswerAsNote` callback (memoised on
  `[question, answer, hits, savingNote, onOpenChange, router]`), and
  renders a single button below the answer panel after streaming
  completes (`!loading && answer`).
- Both flows assemble the body as
  `# <question>\n\n<answer>\n\n## Sources\n\n[#1] icon Title\n…` so
  the note's plaintext index stays clean and the canvas-side render
  matches what the user saw in Ask.

### Added — Quick Capture: batched send routes each thought to its best home

Quick Capture (⌘.) gains a **Send batch** button that lights up
whenever the textarea contains two or more non-empty paragraphs (or
two or more non-empty lines if no blank-line separators are used).
Click it, and the server splits the input, runs a top-1 vector
similarity lookup against your existing notes per item, and routes
each thought to:

- the best-matching existing note (cosine similarity ≥ 0.78), via the
  same client-side append handoff used by Quick Capture's "Append
  to…" chip — never mutating Y.Doc state from the server, so realtime
  consumers stay race-free;
- a single fresh capture note containing the leftover (orphan)
  thoughts joined by blank lines.

This turns Quick Capture into a multi-thought brain dump: type five
ideas separated by blank lines, hit **Send batch**, and three land in
the right existing notes while the other two start a new capture
sticky — without you having to file anything manually.

- **`apps/web/src/server/actions/quick-capture-batch.ts` (new)**:
  `quickCaptureBatch({items})` returns `{appends:
  Array<{noteId,noteTitle,text}>, newNote: {id,title,count} | null}`.
  Embeds each item that's ≥40 chars (shorter fragments are too noisy,
  go straight to the new-note bucket). Single per-item `<=>` query
  against the user's owned + collaborated notes, ordered by distance,
  with `LIMIT 1`. AI quota enforced once per batch (one charge for
  the embed pass — server-side appends don't bump it again).
- **`apps/web/src/components/layout/quick-capture.tsx`**: new
  `splitIntoThoughts(text)` helper (paragraphs first, lines fallback),
  `sendBatch` callback, and the **Send batch** button (only renders
  when ≥2 thoughts detected). Multi-target appends land in a new
  `notai:pending-appends` localStorage list; navigates to the new
  note (or to the first append target if no new note was created).
- **`apps/web/src/components/note/note-workspace.tsx`**: extended the
  pending-append watcher to also drain `notai:pending-appends` —
  filters the list down to entries matching the current note id,
  drops them onto the canvas via `appendTextToScene`, and writes the
  remainder back so the next note we visit picks up its own slice.
  Stale entries (>5 min) are discarded.

### Added — Command palette: graph view, templates, "summarise clipboard URL"

The ⌘K palette gains three quick actions in the **Quick actions**
group:

- **Open note graph** — jumps to the new `/app/graph` view.
- **Browse templates** — opens the template gallery.
- **Summarise URL from clipboard…** — reads the clipboard, validates
  it as an `https?://` URL, runs the same `summariseUrl` action that
  Smart Paste uses, creates a fresh note titled with the page title,
  and drops the captioned summary onto the canvas via the existing
  `notai:pending-append` handoff. One keystroke from "I have a link
  open in another tab" to "I have a saved, summarised note for it".

- **`apps/web/src/components/layout/command-palette.tsx`**: three new
  `CommandItem`s plus a local `summariseClipboardUrl` helper. URL
  validation: `^https?:\/\/\S+$` regex + a `new URL()` parse. Friendly
  toasts for clipboard-permission-denied / non-URL clipboard / invalid
  URL paths. Falls back gracefully when `localStorage` is unavailable
  (note still opens, just without the pre-filled body).

### Added — AI templates: drop a skeleton, optionally have AI fill it from your existing content

The note toolbar gains a **Template** button next to the AI menu.
Clicking it opens a dialog that lists every published template from the
gallery (`/app/templates`) with two per-template actions:

- **Use as-is** drops the template's plaintext skeleton onto the canvas
  as a single text element so the user can fill in the placeholders.
- **Fill with AI** sends the user's existing note content to the model
  along with the template skeleton; the model maps existing material
  into the template's sections (preserving the structure exactly) and
  leaves placeholders empty where there is no evidence to map. Same
  drop path as **Use as-is**.

This turns the existing template gallery (which was create-fresh-note
only) into a *restructure* tool: take a brain-dumped note, apply
&ldquo;Weekly Review&rdquo; with AI fill, get the same content
re-organised under Wins / Stuck on / What I learned / Next week's
focus — without losing anything you already wrote.

- **`apps/web/src/server/actions/apply-template.ts` (new)**:
  `applyTemplateToNote({noteId, slug, mode})` returns
  `{markdown, templateTitle}`. `mode='blank'` returns the template
  skeleton verbatim (no AI quota). `mode='ai-fill'` enforces AI quota,
  reads the note's `plaintext` (truncated to 12 KB), and runs a single
  `streamChat` pass with a strict structure-preserving system prompt;
  falls back to the blank skeleton if the note has no plaintext yet.
  Bumps `templates.uses` for both modes.
- **`apps/web/src/components/note/apply-template-button.tsx` (new)**:
  the toolbar control. Lazy-loads `listTemplates()` on first open;
  renders each template as a card with icon / category / description
  and the two action buttons. Drops the result via the shared
  `insertContent` callback (which now routes through `appendTextToScene`
  thanks to Phase-3 step-2).
- **`apps/web/src/components/note/note-workspace.tsx`**: mounted
  between `VoiceModeButton` and `NoteAiMenu`.

### Changed — Phase 3 step 2 of the canvas migration: TipTap block layer no longer renders

Following step 1 (legacy blocks read-only), step 2 stops rendering the
`BlockFrame` layer entirely. Notes that still have un-migrated TipTap
blocks now show a single visible affordance — the existing migration
banner — which converts the legacy data into native canvas text
elements in one click. Until the user converts, legacy block data
still lives in the Y.Doc (so nothing is lost), but the canvas itself
is now the single source of truth for editing.

- **`packages/editor/src/canvas-note.tsx`**: removed `BlockFrame`,
  `useBlocksArray`, `useBlockFragment`, the per-block hover chrome
  (drag/comment/delete handles), and the entire `data-blocks-layer`
  div. The imperative handle's `addTextBlock` method is gone;
  `insertContent` now drops content onto the Excalidraw scene via the
  shared `appendTextToScene` primitive (with a best-effort
  `flattenJsonToPlaintext` fallback for legacy callers that still pass
  TipTap-shaped JSON). The component shrinks from ~1270 lines to ~990.
- **`apps/web/src/components/note/note-workspace.tsx`**: simplified
  the `insertContent` callback — no more retry-after-block-creation
  fallback, since the canvas is always ready to receive a text element
  once the Excalidraw API is mounted.
- See `docs/excalidraw-migration-plan.md` for steps 3–4 (deleting the
  unused `@tiptap/*` packages from `packages/editor` once no notes in
  the wild still hold un-migrated block data).

### Added — Voice mode: long takes split into paragraphs by pause

A new **Voice mode** button in the note toolbar (next to the existing
Voice button). One click starts recording, a second click stops; while
recording, the button shows a live `mm:ss` timer. On stop, audio is
sent to Whisper with `response_format=verbose_json` so segment-level
timestamps come back, and the client groups segments into paragraphs
wherever the silence gap exceeds **1.4 s** (with a 480-character
hard cap as a fallback splitter for monologues without pauses). Each
paragraph is dropped onto the canvas as its own text element, stacked
naturally below existing content. ADHD-friendly: one continuous take
in, structured paragraphs out, no manual editing.

- **`apps/web/src/server/actions/transcribe.ts`**: new `transcribeAudioSegments(form)` action. Goes around the standard `TranscribeProvider` interface (which only returns `string | null`) and hits Whisper directly with `verbose_json` + `timestamp_granularities[]=segment`. Returns `{ segments: { start, end, text }[], text }`. Counts toward the user's AI quota.
- **`apps/web/src/server/ai/dispatch.ts`**: new `getTranscribeKey(userId)` helper that returns the raw OpenAI key + Whisper model so the action above can call the API directly without breaking the provider abstraction for the simple-text path.
- **`apps/web/src/components/note/voice-mode-button.tsx` (new)**: the toolbar control. Falls back to splitting joined plaintext on `\n\n` + sentence boundaries if Whisper didn't return segment timestamps (older models). Toasts gracefully if the canvas API isn't ready and copies the transcript to the clipboard instead.
- **`apps/web/src/components/note/note-workspace.tsx`**: rendered next to `<VoiceRecorder />`, sharing the existing `canvasRef`.

### Added — Calc named cells across the canvas

Variables defined in one text element are now reachable from any other
text element on the same canvas. Type `tax = 0.19` in one place,
`price = 100` somewhere else, and `price * (1 + tax) =` anywhere will
resolve. The pre-pass runs twice so spatial layout (top-down vs.
right-to-left) doesn't matter — name a value below where you use it
and it still resolves. Local assignments inside one element shadow the
shared scope without polluting it.

- **`packages/editor/src/excalidraw-calc.ts`**: new `collectSharedScope(elements, math)` runs before `buildDesired`. Two iterations over every non-result text element, evaluating `name = expr` lines into a single workspace-level `scope` map. `computeResults(text, math, sharedScope?)` clones that scope as the starting environment for each element so per-element evaluation still works exactly as before — just with names from siblings already present.
- Existing diff-and-apply / `customData.calcResultOf` reconciliation is unchanged, so undo history stays clean and result elements never collide with user-authored content.

### Added — Note graph view

A new **Graph** entry in the sidebar (`/app/graph`) renders every note
in the workspace as a node and every `[[Title]]` reference as an edge.
Layout is a tiny in-page Fruchterman-Reingold simulation (no extra
dep) computed once on mount; node radius scales with combined
in/out-degree, and hovering a node dims the rest of the graph to
highlight that node's direct neighbours plus a sidebar listing of the
linked notes. Click any node to jump straight into it.

- **`apps/web/src/server/actions/note-graph.ts` (new)**: `getNoteGraph()` returns `{ nodes, edges }`. Edges are derived from the `notes.plaintext` mirror by regex-matching `[[Title]]` and resolving against a case-insensitive title→id map (the canvas writes Excalidraw scene text into `plaintext`, so canvas-authored backlinks show up alongside legacy TipTap-authored ones). Capped at 500 most-recently-updated accessible notes (owner or collaborator). Self-references and dangling titles are dropped.
- **`apps/web/src/app/app/graph/page.tsx` (new)** + **`apps/web/src/components/graph/note-graph-view.tsx` (new)**: SVG-only renderer. Two empty-state branches: "no notes yet" and "no links yet" (with a one-line nudge to type `[[`). Hover card shows the up-to-eight neighbours by title.
- **`apps/web/src/components/layout/sidebar.tsx`**: new `Network`-icon entry between **Ask Notai** and **Favorites**.

### Added — Smart paste: drop a URL, get a summary card

Pasting a single URL onto the canvas now fetches the page server-side,
runs the user's BYOK model over the readable text, and drops a clean
text card with the page title, a 2-4 sentence summary, the host, and
the source link — replacing the raw URL Excalidraw would have inserted.
A placeholder ("Summarising …") appears immediately so the action feels
instant; if the fetch fails the placeholder is tombstoned and the user
sees an error toast.

- **`apps/web/src/server/actions/smart-paste.ts` (new)**: `summariseUrl({ url })`. Validates the URL with Zod, blocks obviously private network targets (loopback, RFC1918, link-local, IPv6 ULA/link-local) to avoid SSRF, fetches with an 8s timeout + restricted Accept header, strips script/style/nav/header/footer/aside/svg + tags, decodes common HTML entities, then prompts the model for strict-JSON `{title, summary}`. Falls back to the `<title>` tag if the model returns an empty title. Counts toward the user's AI quota.
- **`packages/editor/src/canvas-note.tsx`**: new `onUrlPaste?: (url: string) => void` prop. Attaches a capturing `paste` listener on the canvas host that intercepts clean single-URL pastes (ignores pastes targeting any input/textarea/contentEditable so the existing Excalidraw text editor still works).
- **`apps/web/src/components/note/note-workspace.tsx`**: `handleUrlPaste` drops a placeholder via `appendTextToScene`, calls `summariseUrl`, then tombstones the placeholder and drops the formatted card.

### Changed — Phase 3 step 1: legacy text blocks are now read-only

The migration to a canvas-canonical note has reached its enforcement
phase. Notes that still contain TipTap text blocks render those blocks
as **read-only** — the canvas around them is the only writable surface.
The migration banner has been rotated to a more urgent amber palette
("These text blocks are read-only — convert to keep editing"); the
underlying conversion is still one click and still rewires comment
anchors to the new Excalidraw element ids.

- **`packages/editor/src/canvas-note.tsx`**: `blocksInteractive` now also gates on `!hasLegacyBlocks`, and a new `blocksReadOnly` (`readOnly || hasLegacyBlocks`) is threaded into every `BlockFrame`. New notes are unaffected (they have zero blocks); only un-migrated notes are downgraded.
- **`apps/web/src/components/note/canvas-migration-banner.tsx`**: amber palette + new copy ("Convert to keep editing"). Rotated the dismissal localStorage key (`notai:canvas-migration-readonly-dismissed:<noteId>`) so previous "soft banner" dismissals don't suppress this stronger one.
- See `docs/excalidraw-migration-plan.md` Phase 3 step 1 for the full rollout plan; steps 2-4 (deleting the BlockFrame layer, dropping `@tiptap/*` from `packages/editor`, bundle audit) follow once telemetry confirms residual edits have stopped.

### Added — Inline citations in the Ask dialog

The command-palette **Ask my notes** dialog (Cmd+Shift+K) now renders
`[#n]` markers in the streamed answer as clickable amber chips that
navigate to the matching note (and close the dialog on click). The
full Ask page already had this; the dialog was the odd one out.

- **`apps/web/src/components/layout/ask-dialog.tsx`**: new `AnswerWithCitations` mirror of the page-level renderer.

### Added — Ask follow-ups on the morning brief

The home dashboard's morning brief now hides a small **"Ask about
this"** affordance under the source chips. Click it, type a question,
get a focused answer that's grounded only in the brief markdown plus
the listed sources — no extra retrieval, no global vector search,
under 120 words. Counts toward the user's AI quota.

- **`apps/web/src/server/actions/morning-brief.ts`**: new `askMorningBriefFollowup({ question, briefMarkdown, sources })` server action. Strict prompt: "answer concisely and only from the brief and listed sources; if the answer isn't there, say so plainly".
- **`apps/web/src/components/dashboard/morning-brief-card.tsx`**: collapsed-by-default composer with an inline answer panel.

### Changed — Daily roll-forward writes onto the canvas

The "you have N open tasks from yesterday" banner on each daily note
no longer tries to insert into a TipTap block (which is now read-only
per Phase 3 step 1). It writes a single Excalidraw text element with a
`## Carried over from <date>` heading + one `[ ] task` line per item.
The existing checklist overlay on the canvas already understands those
lines and toggles them on click, so checking off a rolled-over task
works exactly like checking off any other.

- **`apps/web/src/components/note/rollover-banner.tsx`**: replaced the TipTap-JSON insert path with `appendTextToScene(api, body, { focus: true })`. Surfaces a "canvas not ready" toast if the user clicks before sync completes.
- **`apps/web/src/server/actions/daily.ts`**: `extractOpenTodos` now also walks the Excalidraw scene's text elements for `[ ]` / `[x]` markers (with bullet/number prefixes accepted), so tasks the user creates *on the canvas* — the new normal — are picked up by tomorrow's roll-forward. TipTap-block walker stays in place for backward compatibility.

### Added — Range calc on the canvas

Selecting two or more text elements on the canvas now floats a chip-bar
showing **sum / mean / min / max** of every number found across the
selection (with thousands separators stripped, scientific-style decimals
preserved). Clicking a chip drops the result as a fresh highlighted
text element below the selection's bounding box, ready to drag or
caption. Disabled on read-only mirrors.

- **`packages/editor/src/excalidraw-range-calc.tsx` (new)**: `ExcalidrawRangeCalcOverlay`. One observer subscription via `api.onChange`. Re-parses on every selection change; the chip-bar position is recomputed on viewport changes (zoom / scroll) so it stays glued to the selection.
- **Number parser**: accepts `1,234`, `1 234`, `1_000`, `3.14`, etc. Tags inserted results with `customData.calcRangeResult` so future tooling (export, undo helpers) can find them.
- Mounted in `canvas-note.tsx` next to the existing per-line Calc reconciler.

### Added — Mind map regenerate-in-place

Generating a mind map on a canvas that already has one now prompts the
user to confirm replacement, then tombstones the previous map's
elements (containers, text, arrows tagged with `customData.mindMapNode
/ mindMapText / mindMapEdge`) before laying down the fresh one. Same
viewport-centred layout, no stacking maps on top of each other.

- **`packages/editor/src/mind-map.ts`**: new `hasMindMap(api)` predicate plus `insertMindMap(api, map, { replace: true })`. Replacement marks the previous mind-map elements `isDeleted: true` so they round-trip through Excalidraw's gc.
- **`apps/web/src/components/note/note-ai-menu.tsx`**: detects existing mind maps, asks for confirmation, swaps the toast copy ("Regenerating…" / "Mind map regenerated.").

### Added — Brief sources + save-to-today on the morning brief

The home-page morning brief now lists the up-to-six notes it drew from
as clickable chips beneath the body, and a new **Save to today** action
appends the rendered brief into today's daily note (creating the daily
if it doesn't exist). Reuses the same `notai:pending-append` handoff
the Quick-Capture flow uses, so the brief lands cleanly on the live
Excalidraw scene with no realtime races.

- **`apps/web/src/server/actions/morning-brief.ts`**: returns `sources: { id, title }[]` (top six) alongside the markdown.
- **`apps/web/src/components/dashboard/morning-brief-card.tsx`**: clickable source chips → `Link` to each note. New "Save to today" button calls `getOrCreateDailyNote()`, stashes the brief in `localStorage`, routes to the daily; the receiver in `note-workspace.tsx` replays it onto the canvas as a fresh text element with a `## Morning brief — Mon Jan 13` header.

### Added — Morning brief on the home dashboard

A calm, ADHD-friendly executive-assistant card that opens the home
page with a clear focus for the day. No agent loop, no tool calls,
no autonomy — just a tight Markdown brief drawn from the user's pinned,
today-pinned, and recently-modified notes plus any open `[ ]` action
items it can see in the plaintext. Capped at 220 words. Per-day cached
in `localStorage` so reloading the home page never reburns the AI quota.

- **`apps/web/src/server/actions/morning-brief.ts` (new)**: `generateMorningBrief()` server action. Pulls the last 36 hours of activity plus all pinned notes (capped at 18 sources), shapes a compact corpus (snippets ≤ 600 chars, plus up to 3 unfinished todos per note tagged with `[Today] / [Pinned] / [Nh ago]`), and prompts the model with a strict ruleset (no greetings, no emoji, sentence-case headings, ≤ 220 words). Owner-only — collaborator notes are intentionally excluded so the brief stays personal.
- **`apps/web/src/components/dashboard/morning-brief-card.tsx` (new)**: client card with auto-load-once-per-day, manual refresh, and collapse/expand persisted to `localStorage`. Renders the markdown with the same `whitespace-pre-wrap` treatment used in the rest of the AI surfaces — no extra renderer dependency.
- **`apps/web/src/app/app/page.tsx`**: mounts the card above the dashboard view when the user has at least one note. Empty-state still shows the warm sticky-note collage.

### Added — Quick-Capture knows where things belong

When a captured thought is long enough to be substantive, the Quick-Capture
overlay now suggests up to 2 existing notes that look like a good home
for it (semantic similarity over the user's own embeddings). Clicking
**Append to <Note>** routes to the note and the captured text lands as
a fresh element on the live Excalidraw scene — no race with the
realtime provider, no server-side Y.Doc surgery.

- **`apps/web/src/server/actions/suggest-destination.ts` (new)**: `suggestQuickCaptureDestination({ text, topK })`. pgvector cosine over `notes.embedding`, ACL via owner-or-collaborator, deleted-notes excluded, similarity threshold ≥ 0.78 (anything below is too noisy to surface).
- **`packages/editor/src/append-to-scene.ts` (new)**: `appendTextToScene(api, text, { focus })`. Wraps to ~64 chars per line, places the new text below the lowest existing element (or at the viewport top-left for empty scenes), selects + animates `scrollToContent`. `customData.quickCaptureAppend` tag for downstream filtering.
- **`apps/web/src/components/layout/quick-capture.tsx`**: 700 ms debounced suggestion fetch (no spam while the user types). Renders chips beneath the textarea. The append handoff stashes `{noteId, text, ts}` under `notai:pending-append` and routes via the Next.js router.
- **`apps/web/src/components/note/note-workspace.tsx`**: post-sync replay loop polls for the canvas API, validates the pending payload (right note id, fresh within 5 minutes), calls `appendTextToScene`, clears the storage key, toasts. Stale or mismatched payloads silently expire so a stuck key never stalls the UI.

### Added — One-click AI mind map (`@notai/web`)

The note's AI menu has a new **Generate mind map** entry. It reads the
note's plaintext, asks the model for a strict-JSON tree (Zod-validated
on return), and lays the result out radially on the live Excalidraw
canvas with bound arrows so dragging keeps the edges sticky. Auto-pans
the viewport to the new map.

- **`apps/web/src/server/actions/mind-map.ts` (new)**: `generateMindMap(noteId)` server action. JSON-only system prompt, depth ≤ 3, fan-out caps (7 / 5), strips ```json fences``` if the model adds them, parses + validates with Zod (`MindMapSchema`). Owner/collaborator gated, BYOK-aware, AI quota enforced.
- **`packages/editor/src/mind-map.ts` (new)**: `insertMindMap(api, map)` — radial layout (root at viewport centre, level-1 in a full circle, deeper levels recurse inside their parent's wedge). Per-level font size + palette. Creates rounded `rectangle` containers with bound `text` children + `arrow` edges with proper `startBinding`/`endBinding` so user drags preserve the graph. New nodes get selected and `scrollToContent` animates the viewport onto them.
- **Wiring** in `note-ai-menu.tsx`: button enabled only when `canvasRef` is provided. Reuses the existing menu chrome — no extra UI surface.

### Added — Excalidraw-native Calc (Apple Math Notes parity)

Inline arithmetic on the canvas itself. Type any text element ending
with `=` (e.g. `2400 * 1.19 =` or `revenue = 12000`) and a teal,
auto-updating result element appears next to it. Edit the source text
and the result re-renders within ~180 ms.

- **Plugin** (`packages/editor/src/excalidraw-calc.ts`): `useExcalidrawCalc(api, enabled)` hook subscribes to Excalidraw's `onChange` and reconciles a side-set of result elements via `customData.calcResultOf`. Per-element `mathjs` scope so assignments stay local. Diff-and-apply with a stable signature so the scene is only mutated when results actually change — no re-render loops, no history pollution.
- **Wiring** (`apps/web/src/components/note/canvas-note.tsx`): hook activates whenever a canvas is editable; sticky read-only mirrors stay inert.
- **Dependencies**: `mathjs` 14 added to the workspace catalog and to `@notai/editor`. Lazy-imported so the bundle cost is only paid the first time a user types math.
- **Calc inside legacy TipTap text blocks** (`packages/editor/src/calc-extension.tsx`): the same widget pattern as a ProseMirror plugin so existing notes keep parity until they're migrated.

### Added — Meeting Mode (Granola-style ambient capture)

A right-rail panel that records tab + microphone audio in 60-second
chunks, streams them through the existing Whisper transcription
pipeline, and asks the user's chosen LLM to merge the running
transcript with their raw bullet-point notes into a clean meeting
recap (TL;DR / Decisions / Action items with owners + due dates /
Notes / Open questions). Insert into the current note in one click.

- **Server action** (`apps/web/src/server/actions/meeting.ts`): `enhanceMeetingNotes({noteId, transcript, rawNotes?, language?})`. Note-access check via `noteCollaborators` left-join (collaborators allowed). AI quota enforced. Streams via `streamChat()` with the user's BYOK key. Returns `{markdown}`.
- **Panel** (`apps/web/src/components/note/meeting-mode-panel.tsx`): Tab audio (`getDisplayMedia({audio:true,video:true})` then video tracks discarded — browsers require the video request to grant tab audio) + mic mixed via `AudioContext` + `MediaStreamDestination`. `MediaRecorder('audio/webm;codecs=opus')` with 60-s chunks. Pause/resume, auto-stop on revoked tab share, raw-notes textarea persisted to localStorage per note. Preview pane with Discard / Insert.
- **Toggle** in `note-workspace.tsx`: `Mic` header button, mutually exclusive with chat and comments. State persisted to `localStorage` per note.

### Changed — Excalidraw is the canonical note surface

Foundation for the full TipTap-removal arc. New empty notes open as a
pure Excalidraw canvas (no auto-seeded text block); existing notes
keep their TipTap blocks intact.

- **`packages/editor/src/migrate-doc.ts`**: `migrateLegacyDoc()` no longer creates an empty TipTap block for brand-new notes. Legacy notes still get their `__legacy__` block sentinel — zero data loss.
- **`packages/editor/src/migrate-blocks-to-excalidraw.ts` (new)**: per-note migration `migrateBlocksToExcalidraw(doc)`. Walks each block, extracts plaintext (rich formatting collapses — documented trade-off; Phase 2 reimplements headings/lists/math/mermaid/callouts as Excalidraw-native), creates positioned `text` elements, removes the blocks. Idempotent.
- **Note menu** in `note-workspace.tsx`: "Convert text blocks to Excalidraw…" item with confirm dialog and toast feedback.
- **Phase 2 (not in this release)**: structured-block reimplementation on Excalidraw, then deletion of `text-block.tsx` and `@tiptap/*` from `@notai/editor`. Tracked separately.

### Added — Heading presets on Excalidraw text (Phase 2 kickoff)

First Phase-2 piece of the Excalidraw migration: a floating
H1 / H2 / H3 / Body pill bar appears at the top of the canvas whenever
exactly one text element is selected. Click promotes the element to
the chosen heading level.

- **`packages/editor/src/excalidraw-headings.tsx` (new)**: `ExcalidrawHeadingsToolbar` + `useSelectedText` selection observer. Style stored as `customData.style` (`'h1' | 'h2' | 'h3' | 'body'`) plus `fontSize` (32 / 24 / 20 / 16). Existing un-tagged elements get inferred from font size so the toolbar never misrepresents legacy content.
- **Wiring** in `canvas-note.tsx`: mounted next to the Excalidraw canvas, suppressed on read-only mirrors and shared-link viewers via the same `enabled` flag pattern used by Calc.
- Sets `customData.style` so future outline-extraction / search-ranking / AI summarization passes can treat headings as structural anchors instead of plain text.

### Added — Backlinks on Excalidraw text

Type `[[Note title]]` inside any canvas text element and a clickable
chip pops up beneath the element resolving to the matching note.
Cross-canvas links work the same as in legacy TipTap blocks: clicks
bubble up to `note-workspace.tsx`'s router-push handler via the shared
`<a data-backlink="<id>">` convention.

- **`packages/editor/src/excalidraw-backlinks.tsx` (new)**: read-only overlay over the Excalidraw scene, no custom element types. Per-overlay title→id resolution cache so a 50-link note doesn't fire 50 lookups per `onChange` tick. Unresolved titles render as a muted "?" chip with a hint, so you can fix the typo or create the note.
- Resolves through the existing `searchBacklinks` callback used by the TipTap layer — one source of truth.

### Added — Lists & checkboxes on Excalidraw text

Bullet, numbered, and checklist toggles in the format toolbar plus
click-to-toggle interactive checkboxes drawn over `[ ]` / `[x]` lines.

- **Format toolbar** (`excalidraw-headings.tsx`): three new pills (`•` / `1.` / `☐`) cycle the selected text element's lines through plain ↔ bullet ↔ numbered ↔ checklist. Idempotent: clicking the active mode strips the prefix.
- **`packages/editor/src/excalidraw-checklist.tsx` (new)**: scans every text element for `[ ]` / `[x]` / `- [ ]` / `- [x]` lines and renders an absolutely-positioned interactive checkbox at each one. Click toggles the underlying plaintext. Sits on top of the source `[ ]` glyphs so the rendered box is the only mark visible; works at any zoom because it scales with `viewport.zoom`.
- All three (lists, numbered, checklist) round-trip through migration, plain-text export, and copy-paste — no custom Excalidraw element types added.

### Added — Code & callout presets on Excalidraw text

Two more pills in the format toolbar bring code and callout styling
parity with TipTap.

- **Code** (`</>` pill): toggles the selected text element to monospace (`fontFamily: 3` / Cascadia) and tags `customData.kind = 'code'`. A future syntax-highlighting renderer can opt in by reading the tag — no detection required.
- **Callout** (`❝` pill): wraps the selected text element in a tinted, rounded `rectangle` element (`customData.kind = 'callout'`) grouped together with the text. Toggling again removes the rectangle and ungroups, leaving the original text untouched. Move the group, both move; resize the box, the text stays where it sits.
- Both toggles ship in `excalidraw-headings.tsx` so the canvas has a single floating format bar instead of three separate widgets.

### Changed — Comments support Excalidraw elements as anchors

Foundation for Phase-2 of the Excalidraw migration. The comments
schema now accepts `{kind: 'element', elementId}` alongside the
existing `note` / `block` / `canvas` anchors.

- **`packages/db/src/schema/notes.ts`**: `noteComments.anchor` jsonb `$type` widened to include the element variant. Pure type change — no SQL migration needed because the column is already `jsonb`.
- **`apps/web/src/server/actions/comments.ts`**: `CommentRow.anchor` and the Zod `anchorSchema` accept the new shape; existing comments still validate.
- **`rewireCommentsAfterMigration({noteId, mapping})` (new)**: idempotent server action that takes a `blockId → elementId` map (returned by the canvas migration) and `UPDATE`s every comment whose anchor was `{kind:'block', blockId}` to point at the new Excalidraw element. Note-access gated like the rest of the comments surface.
- **Migration helper** (`packages/editor/src/migrate-blocks-to-excalidraw.ts`) now returns `{count, blockToElement}`; the "Convert text blocks to Excalidraw…" menu item calls `rewireCommentsAfterMigration` automatically and toasts the number of comments re-anchored.

### Added — Live KaTeX & Mermaid previews on Excalidraw

Type `$$ E = mc^2 $$` or a fenced ` ```mermaid` block inside any
canvas text element and a live, lazy-rendered preview appears beneath
it. Source stays editable on the canvas — same dual-view pattern
Notion / Reflect / Bear ship for math.

- **`packages/editor/src/excalidraw-math-mermaid.tsx` (new)**: read-only overlay over the scene. Detects `$$…$$` (KaTeX display math) and ```` ```mermaid…``` ```` blocks per text element. Lazy-imports `katex` (+ its CSS) and `mermaid` only when a user actually types one — zero baseline bundle cost. Per-source render cache (capped at 512 entries) avoids re-rendering on every `onChange` tick. Mermaid runs at `securityLevel: 'strict'` so the user-authored source can't inject HTML.
- **Wiring** in `canvas-note.tsx`: mounted alongside the other Phase-2 overlays. Disabled on sticky mirrors (`enabled={!stickyMode}`) so the lightweight side-panes don't pull KaTeX/Mermaid into their bundle.
- This closes the last structured-block parity gap before Phase 3 strips TipTap from notes entirely.

### Added — Canvas migration nudge banner (Phase 3 kickoff)

Notes that still have TipTap text blocks now show a dismissible
"Convert to canvas" banner. One click runs the migration + comments
re-anchor in a single flow. Phase-3 user-agency over the destructive
final step before we remove the TipTap surface from notes entirely.

- **`packages/editor/src/use-blocks-count.ts` (new)**: reactive `useBlocksCount(doc)` hook subscribing to the Y.Array AND its parent map (so a late-installed array still triggers re-render). Returns `-1` until the doc syncs so the banner doesn't flicker on slow connections.
- **`apps/web/src/components/note/canvas-migration-banner.tsx` (new)**: dismissal persisted to `localStorage` per note. "Convert" calls `migrateBlocksToExcalidraw(doc)` plus `rewireCommentsAfterMigration({noteId, mapping})`, with toasts at every step. Auto-hides once the note is pure-Excalidraw.
- **Wiring** in `note-workspace.tsx`: mounted next to the daily-rollover banner above the canvas, so the prompt is unmissable without being modal.

### Added — Quick capture (P0-7)

P0-7 of the competitive backlog. A friction-free way to dump a thought
into Notai from anywhere in the web app — closing the gap with Apple
Notes Quick Note, Bear's compose sheet, and Notion's `+ New` modal.

- **Server action** (`apps/web/src/server/actions/quick-capture.ts`):
  `quickCapture({text})` validates 1–20000 chars, enforces the `notes`
  quota, picks the first non-empty line (≤ 80 chars) as the note title,
  and persists the rest as plaintext. Creates a sticky-kind note with a
  ⚡ icon. Returns `{id, title}`. Revalidates `/app`.
- **Component** (`apps/web/src/components/layout/quick-capture.tsx`):
  - Floating bottom-right gradient bubble (FAB) — always available on
    every authenticated page, hidden inside Tauri sticky windows via
    the existing `data-focus-hide` convention.
  - `⌘ .` / `Ctrl + .` global hotkey toggles a centered dialog overlay
    with a 6-row textarea, draft persistence in localStorage
    (`notai:quick-capture:draft`) so a tab crash never loses input.
  - Two save modes: `⌘ ↵` saves and stays put for rapid-fire captures,
    `⇧ ⌘ ↵` (or "Save & open") saves and routes to `/app/n/{id}`.
  - "Cancel" closes without persisting; clicking outside is treated as
    "minimize" while text is non-empty (draft survives).
  - Mounted once in `apps/web/src/app/app/layout.tsx`. Shortcut listed
    under Capture in the in-app shortcuts cheatsheet.

### Added — Comments + @-mentions + notifications (P0-6)

P0-6 of the competitive backlog. Notai now ships a real collaborative
discussion surface for notes — closing the gap with Notion / Google Docs
on team workflows.

- **Schema** (`packages/db/drizzle/0008_comments.sql`):
  - `note_comments` — id, `note_id` (cascade), `user_id` (cascade),
    nullable self-referencing `parent_id` for threaded replies, `body`
    text, `anchor` jsonb (discriminated: `{kind:'note'}` /
    `{kind:'block', blockId}` / `{kind:'canvas', x, y}`), `resolved_at`,
    `created_at`, `updated_at`. Indexed on `(note_id, created_at)` and
    `(parent_id)`.
  - `note_comment_mentions` — composite primary key
    `(comment_id, user_id)` for fast mention fan-out.
  - `notifications` — generic in-app notification log with
    `notification_kind` enum (`comment_mention`, `comment_reply`,
    `invite_received`) and a typed jsonb `payload`. Indexed
    `(user_id, read_at, created_at desc)`.
- **Server actions** (`apps/web/src/server/actions/comments.ts`,
  `notifications.ts`):
  - `searchMentionableUsers(noteId, query)` returns the note's
    collaborators (owner + share rows) filtered by name/email prefix.
  - `listComments(noteId)` — flat ordered list with author + mention
    user IDs.
  - `addComment({noteId, body, anchor, parentId?, mentionUserIds})` —
    persists, fans out mentions into `note_comment_mentions`, generates
    `comment_mention` notifications for each mentioned user (excluding
    self), and a separate `comment_reply` notification for the parent
    author when replying (deduplicated against the mention set).
  - `resolveComment` / `unresolveComment` / `deleteComment` (author or
    note owner).
  - Notifications: `listNotifications`, `unreadCount`, `markRead`,
    `markAllRead`.
- **UI**:
  - New right-rail `NoteCommentsPanel` (380px, mutually exclusive with
    the chat panel). Threaded replies, resolve / reopen / delete
    affordances, anchor pills (`block` / `pin`), avatars, relative
    timestamps. Open state persisted per-note in localStorage
    (`notai:comments-panel-open:{noteId}`).
  - Inline `@`-mention picker in the composer — searches collaborators
    on the fly, keyboard-driven (↑/↓/Enter/Tab/Esc), inserts a stable
    `@Display` token tracked in the draft so the server-side ID list
    stays in sync with the visible body.
  - Block hover chrome in `CanvasNote` gains a "Comment on block"
    button. Clicking it opens the comments panel pre-anchored to that
    block; the next "Send" submits with `anchor={kind:'block', blockId}`.
  - Sidebar header gains a `NotificationBell` with unread badge,
    polling every 60s. Dropdown lists the latest 20 notifications,
    deep-links to `/app/n/{noteId}?comment={commentId}`, supports
    "Mark all read" and per-item read-on-click.
- **Note workspace**: dedicated comments toggle button (MessageCircle)
  alongside the chat toggle. Opening one closes the other so the right
  rail stays focused. Block-anchored composer state is kept on the
  workspace and cleared after submit.

### Added — Web Clipper v2 (P0-5)

P0-5 of the competitive backlog ([docs/competitive-analysis.md](docs/competitive-analysis.md)).
The browser extension graduates from "save plaintext blob" to a proper
clipper with Readability article extraction, page screenshots, and
region screenshots — closing the gap with Evernote / Notion Web Clipper.

- **Server**: new `POST /api/clipper/v2` (PAT-auth, node runtime, 30s
  max). Pipeline:
  - `kind=article` — receives full document HTML, runs `linkedom` +
    `@mozilla/readability`, converts the cleaned content with `turndown`
    to Markdown. Stores byline / siteName / excerpt / length in the
    response for the extension to surface.
  - `kind=selection` — stores the user's text selection verbatim.
  - `kind=page-screenshot` / `region-screenshot` — accepts base64 PNG
    (≤ 12 MB), uploads via the existing S3-compatible signer
    (`server/storage/s3.ts`), records an `assets` row, embeds the image
    Markdown into the note's plaintext.
  - All kinds create a single note with a kind-appropriate icon
    (📰/✂️/🖼️/📸) and return `{ id, url, screenshotUrl, extracted }`.
  - v1 (`/api/clipper`) remains for back-compat with old extension
    builds in the wild.
- **Extension** (`apps/extension`, `0.2.0 → 0.3.0`):
  - Adds `tabs` permission for `captureVisibleTab`.
  - Popup: new modes "Article (clean reader view)", "Selection only",
    "Page screenshot", "Region screenshot…". Auto-selects "selection"
    when the user has text highlighted.
  - Region screenshot: in-page overlay with drag-rectangle, ESC to
    cancel, sub-pixel-accurate cropping in an `OffscreenCanvas` that
    respects `devicePixelRatio`.
  - Background SW: context-menu and `Ctrl+Shift+S` now post `kind=article`
    with the full hydrated HTML to v2.
- **Deps**: `@mozilla/readability` 0.6, `linkedom` 0.18, `turndown` 7.2,
  `@types/turndown` 5.0 (web app).

### Added — `@notai/web`: per-note AI chat panel (P0-4)

P0-4 of the competitive backlog ([docs/competitive-analysis.md](docs/competitive-analysis.md)).
A right-side chat panel anchored to the current note. Conversations
persist to `note_chat_messages` (per-user, per-note) so reloading the
page restores the thread.

- **DB**: new table `note_chat_messages` + `chat_role` enum, indexed on
  `(note_id, user_id, created_at)`. Migration `0007_note_chat.sql`,
  applied locally; production runner will pick it up automatically.
- **Server actions** (`apps/web/src/server/actions/chat-with-note.ts`):
  `listChatMessages(noteId)`, `clearChat(noteId)`, and a streaming
  `streamChatTurn({noteId, question})` that retrieves the current
  note's plaintext (always grounded) plus the top 3 vector hits across
  the user's other notes, builds a recent-history transcript (last 12
  turns), enforces `requireQuota('ai')`, and persists both the user
  prompt and the assistant reply.
- **API**: `POST /api/notes/chat` streams NDJSON
  (`citations`, `delta`, `message`, `done`, `error`).
- **UI**: `<NoteChatPanel />` (`apps/web/src/components/note/note-chat-panel.tsx`)
  — collapsible panel with streaming bubbles, Stop, Copy, Clear,
  citation chips that link to the cited note. Open state is
  per-note in localStorage so power users keep it open across reloads.
- Header gains a `MessageSquare` toggle button next to the AI menu.

### Added — `@notai/editor` 0.4.0: inline AI commands (`/ai` slash bar)

P0-3 of the competitive backlog ([docs/competitive-analysis.md](docs/competitive-analysis.md)).
Brings Notion-AI-style writing to the editor: write, continue, expand,
summarize, rewrite (with tone), action-items, improve, translate — all
streaming inline at the cursor and reversible with Discard.

- New `SlashAiContext` bridge (`packages/editor/src/ai-types.ts`) so the
  editor package stays platform-agnostic; the host app passes a
  `runner: (req, signal) => AsyncIterable<string>` and an optional
  `noteId`.
- `SlashMenu.configure({ aiContext })` registers an `/ai` group entry.
  Without `aiContext` the entry is hidden, keeping the menu clean for
  builds without AI configured.
- `AiCommandBar` (`packages/editor/src/ai-command-bar.tsx`) — multi-phase
  popover: action grid (keyboard-navigable) → optional configure step
  (free-form prompt for `write`, language for `translate`, tone chips
  for `rewrite`) → live streaming with **Stop** → review with **Keep**
  or **Discard** (rolls back exactly the inserted range).
- New server route `POST /api/ai/slash` streams NDJSON
  (`{type:'delta'|'done'|'error'}`) with quota enforcement
  (`requireQuota(userId, 'ai')`), per-action prompt construction, and
  optional note-context injection (collaborator-aware via
  `noteCollaborators`). Errors are emitted **into** the stream so the
  command bar UI can surface them inline instead of throwing.
- New client runner (`apps/web/src/lib/slash-ai-client.ts`) wires
  `runSlashAi` into `<NoteWorkspace />`'s `<CanvasNote aiContext />`.
- Reuses the existing provider dispatch (`server/ai/dispatch.ts`):
  Copilot OAuth → user OpenAI BYOK → server env, in that order.

### Added — `@notai/editor` 0.3.0: tables, callouts, toggles, math, mermaid

P0-1 + P0-2 of the competitive backlog ([docs/competitive-analysis.md](docs/competitive-analysis.md)).
Closes the "can I move my notes here?" gap against Notion, OneNote, and
Obsidian without changing the canvas-first document model.

- **Tables** — `@tiptap/extension-table` family (table, row, header, cell)
  with column resizing. Slash menu `/table` inserts 3×3 with header row.
  Toolbar surfaces `Add row · Add column · Toggle header · Delete table`
  contextually when the cursor is inside a table.
- **Callouts** — new block node `callout` with five variants (info, tip,
  success, warn, danger). Each variant has a default emoji icon and an
  OKLCH-mixed accent so it reads correctly in both themes. Slash menu
  exposes one entry per variant; toolbar has a single quick-toggle.
- **Toggle blocks** — collapsible `toggleBlock` with `toggleSummary` +
  `toggleContent` children, `open` attribute synced through Yjs so
  collaborators see the same fold state. ProseMirror plugin handles
  chevron clicks; CSS hides content via `[data-open='false']`.
- **Math (KaTeX)** — both inline (`mathInline`) and block (`mathBlock`)
  atoms with a React node view. Click renders KaTeX, click again to edit
  raw LaTeX in a textarea. KaTeX is loaded lazily from jsDelivr the first
  time a math node renders, keeping the cold-start bundle untouched.
- **Mermaid diagrams** — `mermaid` block atom with a React node view.
  Lazy-loads the mermaid library on first render and chooses dark/neutral
  theme based on the document class. Double-click to edit the source.
  Errors are caught and rendered with the offending source.
- Slash menu groups now include `advanced` and (reserved) `ai`; group
  rendering follows a fixed `GROUP_ORDER` so menu shape is stable.
- `packages/ui/src/styles.css` — new `.tiptap-table`, `.tiptap-callout`,
  `.tiptap-toggle*`, `.tiptap-math*`, `.tiptap-mermaid*` rules using the
  existing OKLCH palette + `color-mix(in oklab, …)` for theming.

### Fixed — DB migrations: prevent silent skips (root-cause + hardened runner)

Drizzle's postgres-js migrator decides what to apply by comparing each
journal entry's `when` timestamp against the latest `created_at` already
recorded in `drizzle.__drizzle_migrations`. `0004_rbac_billing_admin` had
`when=1778305649166` in `_journal.json` — older than `0002` and `0003`.
Once `0003` was recorded with `created_at=1778600000000`, drizzle
silently treated `0004` as already applied and moved on to `0005`. The
Phase-1 schema (RBAC, plans, broadcasts, audit log, etc.) was rescued by
hand-applying `0004.sql` directly, but the corresponding hash row was
never inserted, so the bookkeeping diverged from reality.

The custom `scripts/migrate.mjs` runner masked the gap with a second
bug: it computed pending migrations as
`appliedHashes.size < journal.entries.indexOf(entry) + 1` instead of
checking actual hash membership. With 5 rows recorded and 6 on disk it
reported "1 pending" and called drizzle-migrate, which did nothing for
`0004` (per above), recorded `0005`, and the runner reported success.

Changes:

- `packages/db/drizzle/meta/_journal.json` — `0004.when` rewritten to
  `1778700000000` (between `0003` and `0005`) so future fresh databases
  apply migrations in true chronological order.
- Backfilled the missing `0004` hash row into local + production
  `drizzle.__drizzle_migrations` (one-shot script, deleted after use).
- `scripts/migrate.mjs`:
  - Pending detection now checks **hash membership**, catching gaps
    instead of hiding them.
  - Validates `_journal.json` `when` is strictly monotonic at startup;
    refuses to run otherwise (exit 3).
  - Strips any pre-existing `DATABASE_URL` from the shell environment
    so `node --env-file=…` is the single source of truth (previously a
    leaked prod URL would silently override `.env.local`).
  - Post-apply verification re-reads `__drizzle_migrations` and
    HARD-FAILS (exit 4) if any on-disk migration hash is still
    missing — stops the same class of bug from sneaking back.

Both `--env=local` and `--env=production --dry-run` now report 0 pending
and 6/6 hashes recorded.

### Changed — `@notai/editor` 0.2.0 + `@notai/realtime-server` 0.2.0 (canvas-first notes)

The editor was a TipTap text column with an Excalidraw drawing layer
overlaid on top, sharing only a leaky `width/height/scrollTop` bridge in
the Y.Doc. Stickies re-rendered text at a different width, drawings (in
absolute world coordinates) drifted off the lines they were drawn on, and
ctrl+wheel zoom couldn't work because text and canvas had incompatible
coordinate systems.

The new model makes Excalidraw the document. Text lives in positioned
blocks (`getMap('scene').get('blocks')` → ordered list of `{id,x,y,width}`)
with each block's TipTap content under `getMap('blocks-content').get(id)`
as a `Y.XmlFragment`. Both layers share Excalidraw's `{scrollX, scrollY,
zoom}`; the blocks layer applies the same transform via CSS. Stickies are
read-only viewers of the same scene with auto fit-to-content + native
ctrl+wheel zoom.

- **New `packages/editor/src/canvas-note.tsx`**: top-level component;
  Excalidraw + blocks overlay + drag/resize/delete handles + "Add text
  block" overlay button. Exposes a `CanvasNoteHandle` ref so consumers can
  insert content into the focused block (AI, voice, asset upload).
- **New `packages/editor/src/text-block.tsx`**: TipTap micro-editor bound
  to one `Y.XmlFragment`. Reports focus changes upward.
- **New `packages/editor/src/migrate-doc.ts`**: lazy migration. On first
  open of an existing note we materialize one block referencing the legacy
  `getXmlFragment('default')` (or `'prosemirror'`) via the sentinel id
  `__legacy__`, preserving all collaborative history.
- **Removed `note-editor.tsx`, `drawing-canvas.tsx`, `canvas-viewport.ts`**:
  superseded. Old cross-layer geometry bridge is gone.
- **`apps/web/src/components/note/note-workspace.tsx`**: no more `Drawing`
  toggle — Excalidraw's own toolbar picks selection / hand / pen / shape /
  text / etc. Toolbar follows the focused block.
- **`apps/web/src/components/note/sticky-window.tsx`**: collapses to a
  single `<CanvasNote readOnly stickyMode>`; gains ctrl+wheel zoom and
  pixel-perfect drawing alignment.
- **`apps/realtime-server/src/index.ts`**: `extractPlaintext` walks the new
  `blocks-content` map (and the legacy fragment via `__legacy__`) so
  search, embeddings, and the FTS index keep working through migration.

No DB schema changes. Existing notes keep their `yjsState` blob and migrate
on first open transparently.

### Fixed — `@notai/realtime-server` 0.1.7 (Cloud SQL Unix socket)

- **`packages/db/src/client.ts`**: Cloud Run realtime service couldn't start
  on Postgres because the production `DATABASE_URL` uses the Cloud SQL Unix
  socket form `postgres://user:pass@/dbname?host=/cloudsql/...`, which Node's
  WHATWG URL parser rejects (empty hostname). The client now detects that
  exact form and constructs a `postgres()` config object directly instead of
  passing the raw URL string. Plain Postgres URLs and Neon URLs are
  unchanged.

## [@notai/realtime-server 0.1.7] - 2026-05-08

See Unreleased above.

### Added — Phase 0–3 expansion

#### Phase 0 — table-stakes for "really" daily-use

- **Sharing**: per-note collaborator + invite-by-email flow. Pending invites
  are stored hashed (sha256 of a random 32-byte token, base64url-encoded),
  expire in 14 days, and accept via `/share/accept?token=…`. New
  `note_invites` table.
- **Global search**: `searchNotes` server action wired into the command
  palette (⌘K). Trigram GIN index over `title` + `plaintext`, ranked with
  similarity × 3 on title + recency boost. Highlighted snippets in the UI.
- **Trash + auto-purge**: notes are now soft-deleted (`deleted_at`),
  `/app/trash` lets the user restore or empty, and a daily Vercel cron
  (`/api/cron/purge-trash`) hard-deletes anything older than 30 days.
- **Onboarding**: first sign-in seeds 4 starter notes (welcome, capture,
  today, draw-here) via the `events.createUser` callback in `auth.ts`.
- **Asset uploads**: drag-drop / picker → presigned PUT to any S3-compatible
  bucket (R2, GCS, S3) via a hand-rolled SigV4 client (no AWS SDK).
  See `docs/storage.md`. Editor inserts an `<img>` on success.
- **Sentry + PostHog**: opt-in observability across web + realtime server.
  See `docs/observability.md`.

#### Phase 1 — power-user feel

- **Tags**: chip input next to the title, with `attachTag` / `detachTag`
  server actions. Tag names are normalized to lowercase + hyphens.
- **Backlinks**: `[[` autocomplete in the editor (TipTap mention suggestion
  driven by `searchBacklinkCandidates`), and a "Linked from" panel below
  each note.
- **Quick capture (desktop)**: `Ctrl/Cmd+Shift+N` global hotkey + tray menu
  open a borderless sticky window pointed at `/app/quick-capture`, which
  creates a fresh note server-side and redirects.
- **Web clipper extension**: MV3 extension at `apps/extension/` with
  popup, context menu, and keyboard shortcut. Uses Personal Access Tokens
  (`personal_access_tokens` table) hashed at rest. New `/api/clipper`
  POST and `/api/clipper/whoami` GET routes.
- **Integrations page**: `/app/settings/integrations` shows MCP setup info
  for Claude / ChatGPT and lets the user manage clipper PATs.

#### Phase 2 — AI-native, but private

- **Pro tier (Stripe)**: Checkout + Customer Portal flow.
  `/api/stripe/webhook` is signature-verified and idempotent through
  `billing_events`. New `subscriptions` table mirrors plan + status.
  See `docs/billing.md`.
- **"Ask my notes" (RAG)**: pgvector `vector(1536)` column on `notes` plus
  HNSW `vector_cosine_ops` index. Embeddings refresh in the background via
  `/api/cron/embed-notes` (every 15 minutes). The streaming `/api/ask`
  endpoint returns NDJSON events (`hits`, `delta`, `error`); `AskDialog`
  renders the answer with cited sources.
- **Voice → text**: `MediaRecorder` → multipart upload → OpenAI Whisper.
  Transcript is inserted at the cursor.
- **Per-note AI menu**: summary, action-items extraction, and
  rewrite-for-clarity. Each renders into a dialog with a "Insert into note"
  button.
- **Version history**: realtime server snapshots Y.Doc state every 25
  edits or 5 minutes into `note_versions`. The Version History dialog
  lists snapshots, previews them, and restores via `restoreVersion`.

#### Phase 3 — distribution

- **Templates gallery**: `/app/templates` with 7 official templates
  (daily plan, weekly review, meeting notes, reading log, project brief,
  3-things gratitude, idea capture). Seeded by `pnpm --filter @notai/db
  seed:templates`.
- **Microsoft Store**: submission checklist at
  `apps/desktop/store/microsoft/SUBMISSION.md`.
- **Mac App Store**: setup guide at `docs/mac-store-setup.md` covering
  the cert flow, entitlements, and GitHub Actions secrets.
- **Mobile (PWA + Tauri)**: enriched manifest with shortcuts + screenshots,
  share-target, and `web+notai://` protocol handler. Native iOS/Android
  via `pnpm tauri ios|android dev` is in preview. See `docs/mobile.md`.

### Database

Single migration `0002_phase0_to_3.sql` adds, in one transaction:

- `vector` extension + `notes.embedding vector(1536)` + HNSW index
- `notes.deleted_at`, `notes.embedding_model`, `notes.embedding_updated_at`
- `note_invites`, `subscriptions`, `billing_events`, `note_versions`,
  `templates`, `personal_access_tokens` tables
- enums: `plan_tier`, `sub_status`

Apply with `pnpm db:migrate (local)` or `pnpm db:migrate (production)`.

### Security


- **Auth.js**: disabled `allowDangerousEmailAccountLinking` (Google provider)
  to prevent account takeover via attacker-controlled accounts that share an
  email with a victim's verified account.
- **Sessions**: shortened TTL from 30 days to 7 days; explicit cookie config
  (`__Secure-` prefix in production, `httpOnly`, `sameSite=lax`, `secure`).
- **Headers**: added Content-Security-Policy, Cross-Origin-Opener-Policy,
  Cross-Origin-Resource-Policy, Origin-Agent-Cluster, X-DNS-Prefetch-Control;
  expanded Permissions-Policy denylist (payment, usb, interest-cohort).
- **Rate limiting**: in-memory per-process limiter with standard 429
  responses applied to:
  - `/api/oauth/token` — 20 req/60s per client_id
  - `/api/oauth/register` — 10 req/hour per IP
  - `/api/mcp` — 120 req/60s per token
  - `/api/desktop-auth/poll` — 60 req/60s per device code
  - `/api/desktop-auth/issue` — 10 req/60s per user
  - `sendContactMessage` server action — 5 req/10min per IP
- **MCP**: error responses no longer leak raw exception messages — only
  explicit `mcpError()` throws return their text; unexpected errors return
  a generic message and are logged server-side.
- **Contact form**: removed PII (name, email body) from dev-fallback log;
  fails closed in production when `RESEND_API_KEY` is missing instead of
  silently pretending the email was sent.
- **Env validation**: extended `@notai/lib/env` schema with
  `RESEND_API_KEY`, `CONTACT_INBOX`, `CONTACT_FROM`, `UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN` (all optional).

### Added

- Pre-commit and pre-push hooks (Husky + lint-staged) enforcing format, lint,
  typecheck, build, and a CHANGELOG entry on version bumps.
- `getFolder` server action and `previewHtml` preview field on `listNotes`.
- GitHub Actions (release-only — quality gates run locally before push):
  - `release-realtime.yml` — builds the Docker image and rolls out the
    Hocuspocus server to Cloud Run when `apps/realtime-server/package.json`
    version changes on `main`.
  - `release-desktop.yml` — builds and signs Windows / macOS / Linux installers
    via `tauri-apps/tauri-action` and publishes a GitHub Release when
    `apps/desktop/package.json` version changes on `main`.
- Vercel git integration handles the web app — auto-deploys on every push
  to `main`. `apps/web/vercel.json` + `scripts/vercel-should-build.mjs`
  skip rebuilds when the commit didn't touch the web app.
- Optional self-host `apps/web/Dockerfile` for non-Vercel targets.
- `scripts/check-changelog.mjs` and `scripts/detect-version-bumps.mjs` helpers.

### Changed

- ESLint flat config in `apps/web` now uses the documented
  `import nextPlugin from 'eslint-config-next'` entry point (the `flat.js`
  subpath was removed in `eslint-config-next@16`).

### Fixed

- TypeScript: missing `getFolder` import in the folder page; missing
  `previewHtml` field on note cards.
- ESLint: `postcss.config.mjs` anonymous default export warning; React 19
  `set-state-in-effect` rule disabled for legitimate mount-only reads.

## [@notai/realtime-server 0.1.6] - 2026-05-07

### Fixed

- `DATABASE_URL` socket form needs a placeholder host (`localhost`) so
  Node's WHATWG URL parser accepts it; Cloud SQL connection is then
  routed through the `?host=/cloudsql/...` query param.

## [@notai/realtime-server 0.1.5] - 2026-05-07

### Changed

- Switched DB provider from Neon to Cloud SQL Postgres 16 in
  `notai-prod`/`europe-west1` (instance `notai-pg`).
- Cloud Run deploy attaches Cloud SQL via `--add-cloudsql-instances`;
  `DATABASE_URL` in Secret Manager uses Unix socket form.
- Mapped `realtime.notai.ro` to the Cloud Run service via Google Cloud
  domain mapping; CNAME added to Vercel DNS.

## [@notai/realtime-server 0.1.4] - 2026-05-07

### Fixed

- esbuild now externalises every npm dependency and only inlines the
  workspace packages (`@notai/*`). Bundling CJS deps like `ws` into ESM
  broke at runtime with `Dynamic require of "events" is not supported`.
  Dockerfile uses `pnpm deploy` to ship the flattened third-party
  `node_modules` next to the bundled `dist/index.js`.

## [@notai/realtime-server 0.1.3] - 2026-05-07

### Fixed

- Switched build to esbuild bundling so the Cloud Run container ships a
  single self-contained `bundle.mjs`. This avoids Node's
  `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` when workspace packages
  (`@notai/db`, `@notai/lib`) export `.ts` source directly.

## [@notai/realtime-server 0.1.2] - 2026-05-07

### Fixed

- Dockerfile now uses `pnpm deploy` to flatten workspace symlinks; the
  previous image failed to start with `ERR_MODULE_NOT_FOUND` for
  `@hocuspocus/server` because pnpm's symlink layout was not preserved
  across multi-stage `COPY`.

## [@notai/realtime-server 0.1.1] - 2026-05-07

### Added

- First Cloud Run deployment to `europe-west1` (project `notai-prod`).
- `release-realtime.yml` now wires Secret Manager refs for `DATABASE_URL`
  and `HOCUSPOCUS_JWT_SECRET`, sets port 1234, session affinity, and uses
  the `notai-deploy` service account.

## [@notai/desktop 0.1.23] - 2026-05-10

### Fixed

- Sidebar update icon now opens the install confirmation toast directly
  on click. Previously the icon only re-checked for an update and
  flipped its own visual state — the actual `Install & restart` toast
  was rendered exclusively by the mount-time / hourly poll in
  `AppUpdater`, so once the toast had been dismissed (or the user
  navigated past the moment it fired) clicking the warning triangle
  did nothing visible.
  - Extracted `showUpdateAvailableToast` / `showUpToDateToast` into a
    shared helper `apps/web/src/components/layout/update-toast.ts` so
    the toast renders identically from both surfaces.
  - `AppVersion.onCheck` now calls the helper directly: an available
    update opens the sticky `Install & restart` / `Later` toast, and
    "up to date" shows a brief success toast.
  - Tooltip on the warning icon updated to "Update available — click to
    install" to match the new behavior.
  - This is shipped as a desktop release so existing installs that
    haven't reloaded the webview pick up the fix immediately via the
    auto-updater; web/Vercel users get it on next reload regardless.

## [@notai/desktop 0.1.22] - 2026-05-10

### Added — Dashboard sort, filter, drag-reorder & saved views

The dashboard landing page (`/app`) is now a fully configurable workspace
with server-persisted saved views, smart filters, animated drag-and-drop
reordering (mouse + touch + keyboard), and a Today-only pin separate from
the global pin.

**View bar** (sticky top of the dashboard):
- View dropdown with all saved presets, "Make default", "Rename", "Delete",
  and "Save as new view…".
- Sort dropdown: Recently updated / created / opened, Alphabetical, Custom
  (drag to reorder); plus a "Pinned first" toggle modifier.
- Filters popover: full-text search, status (pinned / on Today / favorite /
  archived), kind (note / sticky), updated-within (any / today / 7d / 30d),
  folder multi-select, tag multi-select, color, and "Has collaborators".
- Active-filter count badge; "Save view" / "Update view" / "Save as new"
  appear only when the active spec is dirty.

**Drag-and-drop**:
- `@dnd-kit/core` with three sensors — `PointerSensor` (4 px desktop),
  `TouchSensor` (250 ms long-press, 8 px tolerance — standard mobile
  pattern that doesn't hijack scroll), and `KeyboardSensor` for a11y.
- Drag handle is hover-only on devices with hover, always visible on
  touch devices via `@media (hover: none)`.
- Dragging while sort is non-custom auto-switches to custom order with a
  toast (the user's drag isn't silently discarded).
- Light haptic via `navigator.vibrate?.(10)` on supporting devices.

**Pin on Today** (`notes.is_pinned_on_today` boolean):
- Separate from the global `isPinned` flag (which still drives the
  sidebar's Pinned section). Cards pinned on Today float into a dedicated
  "Pinned on Today" section above the rest.
- Toggle from the right-click context menu on any note card.

**Saved views**:
- New `user_views` table (`scope`, `name`, `sort`, `pinned_first`,
  `filters` jsonb, `is_default`, `position`). Cap of 20 views per user.
- First saved view becomes the default automatically.
- Active view persisted to localStorage (`notai:dashboard-active-view`).

**Animations**:
- Framer Motion `<motion.div layout>` per card for grid reflow on sort/
  filter changes; spring `initial/animate/exit` for add/remove pop;
  `<AnimatePresence mode="popLayout">` to keep transitions smooth.

**Migration**: `0009_dashboard_views.sql` adds
`notes.is_pinned_on_today` + `notes_owner_today_pinned_idx` and creates
the `user_views` table with two indexes.

Files:
- `packages/db/src/schema/notes.ts` — added `isPinnedOnToday`.
- `packages/db/src/schema/views.ts` — new `userViews` table.
- `packages/db/drizzle/0009_dashboard_views.sql` — migration.
- `apps/web/src/lib/view-spec.ts` — Zod `viewSpecSchema` + `filterSchema`.
- `apps/web/src/server/actions/views.ts` — `listDashboardViews`,
  `saveDashboardView`, `deleteDashboardView`, `setDefaultDashboardView`,
  `renameDashboardView`.
- `apps/web/src/server/actions/notes.ts` — added `togglePinnedOnToday`
  and `listNotesForView` (server-side filter + sort using existing
  indexes); `listNotes` legacy signature kept for the sidebar.
- `apps/web/src/components/dashboard/*` — `dashboard-view.tsx`,
  `dashboard-view-bar.tsx`, `sortable-note-grid.tsx`,
  `sortable-note-card.tsx`.
- `apps/web/src/app/app/page.tsx` — refactored to load views + folders
  + tags in parallel and render `<DashboardView>`.
- `apps/web/src/components/note/use-note-actions.tsx` — added
  "Pin on Today" / "Unpin from Today" context-menu item.

## [@notai/desktop 0.1.21] - 2026-05-10

### Changed — Compact single-line version footer with icon-only update check

The version footer under the Notai logo is now a single line with
all three component versions (`web v… · app v… · rt v…`) and an
icon-only update check button:

- **Refresh icon** (default) — click to check for updates.
- **Spinning refresh** — check in progress.
- **Yellow warning** — an update is available; the existing install
  toast handles the actual upgrade.
- **Green check** — confirms "you're on the latest" for ~2 s, then
  reverts to the refresh icon.

The desktop version is hidden when running in the browser (only
`web` and `rt` are shown). The realtime server version is exposed
to the client via `NEXT_PUBLIC_REALTIME_VERSION`, read at build
time from `apps/realtime-server/package.json`.

- **`apps/web/src/components/layout/app-version.tsx`**: rewritten
  for the new layout; subscribes to `updater://available` so the
  warning icon also lights up from the boot-time updater poll.
- **`apps/web/next.config.ts`**: also reads
  `apps/realtime-server/package.json` and exposes
  `NEXT_PUBLIC_REALTIME_VERSION`.
- **`apps/web/package.json`**: bumped to 0.1.2.

## [@notai/desktop 0.1.20] - 2026-05-10

### Added — App version display + manual update check

The sidebar now shows the current web and desktop app versions in
small muted text under the Notai logo, plus a "Check for updates"
link (desktop only) so users can trigger an update check on demand
instead of waiting for the hourly poll.

This also explains the most common "why didn't I auto-update?"
question: the in-app updater poll runs hourly, and the GitHub
`releases/latest` redirect only resolves to a desktop release when
the most recent published release across the whole monorepo is a
desktop one. If a `realtime-server` release was the latest, the
desktop endpoint returned 404 and the update check failed silently
on older builds. v0.1.18+ already prompts on success; this version
adds a manual fallback for the silent-failure case.

- **`apps/web/src/components/layout/app-version.tsx`**: new
  client component. Reads web version from
  `process.env.NEXT_PUBLIC_APP_VERSION` (injected by next.config.ts
  from `apps/web/package.json`), reads desktop version via
  `@tauri-apps/api/app#getVersion()` when running under Tauri,
  exposes a "Check for updates" action that invokes the existing
  `check_for_update` command and shows a sonner toast when no
  update is available.
- **`apps/web/src/components/layout/sidebar.tsx`**: render
  `<AppVersion>` immediately under the brand block.
- **`apps/web/next.config.ts`**: read `package.json` at build time
  and expose `NEXT_PUBLIC_APP_VERSION` via `env` so the version is
  inlined into the client bundle.
- **`apps/web/package.json`**: bumped to 0.1.1 so the displayed
  web version reflects the change.

## [@notai/desktop 0.1.19] - 2026-05-10

### Fixed — Start-minimized only applies to autostart launches

The "Start minimized to tray" setting was hiding the main window on
every launch — including manual opens and post-install/post-update
launches. It now only kicks in when Windows starts the app via the
autostart entry (which is the only path that passes `--minimized`).
The setting label now reads "Start minimized to tray on Windows
startup" to match.

Also fixes the brief flash where the window appeared for a moment
before being hidden: the main window is now configured `visible:
false` and explicitly `.show()`n only when we don't intend to hide
it, so autostart launches go straight into the tray with no flicker.

- **`apps/desktop/src-tauri/tauri.conf.json`**: main window
  `visible: false`.
- **`apps/desktop/src-tauri/src/lib.rs`**: setup hook now hides only
  when both the autostart `--minimized` flag is present AND the
  `start_minimized` setting is true; otherwise calls `show()` +
  `set_focus()`.
- **`apps/web/src/components/settings/settings-form.tsx`**: clearer
  copy explaining the autostart-only scope.

## [@notai/desktop 0.1.18] - 2026-05-10

### Changed — Confirm before installing updates

The auto-updater no longer downloads or installs anything without asking.
On boot (and every hour after), if a newer release is available the app
shows a sticky in-app notification with the new version and release notes.
Clicking **Install & restart** is what actually downloads, applies, and
restarts — matching Bear, Obsidian, and Notion's update UX.

- **Rust** (`apps/desktop/src-tauri/src/lib.rs`): the silent
  `check_for_updates` task is gone. Replaced with `startup_update_check`
  which only checks and emits `updater://available` with `{version,
  current_version, notes}`. Three new invoke commands: `check_for_update`
  (returns `Option<UpdateInfo>` without installing), `install_update`
  (downloads + installs + restarts), `restart_app` (parity with the JS
  layer). All three registered in the invoke handler — they were missing
  before, so the JS fallbacks had been silently failing.
- **Web** (`apps/web/src/components/layout/app-updater.tsx`): mount-time
  check + 1h interval re-check. Sticky toast with "Install & restart" /
  "Later" actions; switches to a "Downloading update…" loading toast on
  click, and surfaces `toast.error` on failure.

## [@notai/desktop 0.1.17] - 2026-05-10

### Fixed

- **Sticky-note windows could navigate away from `/sticky/{id}`.** After an
  error and refresh, an auth-flow loop, or any stray Next.js client-side
  navigation, the borderless widget could end up showing the entire `/app`
  workspace inside what is supposed to be a tiny sticky. The Tauri host now
  installs an `on_navigation` filter on every sticky and quick-capture
  webview that only allows the window's own route, the sign-in flow
  (`/signin`, `/api/auth/`), and Next.js asset/RSC traffic (`/_next/`).
  A complementary `popstate` guard inside `StickyWindow` snaps `location`
  back if a soft client-side push slips through (Next.js' `history.pushState`
  bypasses Tauri's nav hook).
- **Sticky landed off-screen after sleep / wake / unplugging a monitor.**
  `tauri-plugin-window-state` faithfully restored the saved position even
  when the secondary display it pointed at was no longer connected, leaving
  the borderless widget unreachable (no titlebar to drag). New
  `ensure_on_visible_monitor` helper checks every connected monitor for at
  least 100×100 px of overlap with the window rect and recentres on the
  primary display when none qualifies. Runs immediately after `build()`
  in `spawn_sticky` and `spawn_quick_capture`, plus when re-focusing an
  already-open sticky.

## [@notai/desktop 0.1.16] - 2026-05-08

### Fixed

- **Sticky / settings / quick-capture windows opened `http://localhost:15600`
  in production**, showing "localhost refused to connect". The Rust
  `app_url()` helper read `NOTAI_WEB_URL` only at runtime and fell back to
  localhost when the env var wasn't set on the end-user's machine. It now
  prefers the runtime env var, then `option_env!("NOTAI_WEB_URL")` baked at
  compile time, and finally defaults to `https://notai.ro` in release
  builds (debug builds still default to localhost).

## [@notai/desktop 0.1.15] - 2026-05-09

### Fixed

- **Two duplicate tray icons in the Windows system tray.** One was
  auto-created by Tauri from `app.trayIcon` in `tauri.conf.json`, the
  other was created by `TrayIconBuilder::with_id("main")` in `lib.rs`.
  Only the runtime one had a menu and click handlers, so the static one
  appeared as a non-interactive ghost. Removed the static `trayIcon`
  config; the runtime builder now also sets the icon via
  `app.default_window_icon().unwrap().clone()` so the single tray icon
  renders correctly.

## [@notai/desktop 0.1.14] - 2026-05-09

### Fixed

- **Sign-in actually opens the system browser.** The desktop app's main
  window loads remote content (`https://notai.ro/app`), but the default
  capability had no `remote.urls` whitelist — Tauri 2 capabilities are
  `local: true` by default, so plugin commands (including
  `plugin:opener|open_url`) were rejected by the ACL with
  `Command plugin:opener|open_url not allowed by ACL` whenever they were
  invoked from a remote page. Sign-in showed the manual-URL fallback
  toast on every click.

### Changed

- Added `remote.urls = ["https://notai.ro/*", "http://localhost:*/*"]`
  to `apps/desktop/src-tauri/capabilities/default.json` so all listed
  permissions apply to the production web app and to local dev.

## [@notai/desktop 0.1.13] - 2026-05-09

### Fixed

- **Installer actually runs again.** v0.1.12 wrapped the Tauri `setup.exe`
  with a fully silent NSIS launcher (`SilentInstall silent`). When anything
  on that path failed (Defender block, `ExecWait` chain, previous-version
  uninstall hanging on the upstream PageReinstall flow), the user saw zero
  UI and zero feedback — "nothing happens" on double-click.

### Changed

- **Replaced the wrapper-around-setup.exe approach with a custom Tauri NSIS
  template** (`apps/desktop/src-tauri/windows/installer.nsi`, wired via
  `bundle.windows.nsis.template` in `tauri.conf.json`). The template is a
  fork of upstream `tauri-bundler` v2.10.0 with two minimal patches:
  - `.onInit` always sets `$PassiveMode = 1`, so every invocation (GUI
    double-click, silent install, auto-update) skips the Welcome / License /
    Reinstall / Directory / StartMenu / Finish pages and renders only the
    `MUI_PAGE_INSTFILES` progress dialog.
  - `.onInstSuccess` always launches the app after a passive/silent
    install — `/R` is no longer required.
- `setup.exe` is now Tauri's standard, single-stage NSIS installer (no
  outer wrapper, no double `ExecWait` chain). The auto-updater signature
  produced by `tauri-action` is still valid, so no re-signing step is
  needed in CI.

### Removed

- `apps/desktop/scripts/installer-wrapper.nsi`.
- `apps/desktop/scripts/build-installer.ps1`.
- The `Wrap Windows installer (progress-only, auto-launch)` step from
  `.github/workflows/release-desktop.yml`.

## [@notai/desktop 0.1.12] - 2026-05-08

### Changed

- **Windows installer is now a single file with a single, minimal UI.**
  - The wrapper that previously shipped as a separate `*-silent-setup.exe`
    is gone. Instead, the same wrapper now **replaces** the standard
    `Notai_<v>_x64-setup.exe` in CI, and gets re-signed with the Tauri
    updater key so the auto-updater signature still validates.
  - The wrapper invokes Tauri's inner setup with `/P /R`. In Tauri's NSIS
    template `/P` is "passive mode": it skips the Welcome / License /
    Components / Reinstall / Install-Location / Start-Menu / Finish pages
    and shows **only the install progress bar**. Tauri's reinstall flow
    auto-uninstalls any previous version. `/R` auto-launches the app when
    install completes.
  - Users who download `Notai_<v>_x64-setup.exe` and double-click see a
    single Tauri progress dialog that auto-closes — no welcome screen,
    no Next button, no install location prompt, no finish page.
  - Auto-updates use the same wrapper (updater calls it with `/S /R`); the
    wrapper still hands off to the inner setup with `/P /R`, so updates
    show the same minimal progress UI.
- **Release notes now contain direct download links.** The `publish-release`
  job rewrites the release body with a markdown table mapping each platform
  to its primary asset (`Notai_<v>_x64-setup.exe`, `Notai_<v>_x64_en-US.msi`,
  `Notai_<v>_universal.dmg`, `Notai_<v>_amd64.AppImage`,
  `Notai_<v>_amd64.deb`, `Notai-<v>-1.x86_64.rpm`).
- Updater `installMode` switched from `quiet` back to `passive` so it
  matches the wrapper's behavior (`/P /R`) for consistency.

### Removed

- `apps/desktop/scripts/silent-wrapper.nsi` (renamed to
  `installer-wrapper.nsi`).
- `apps/desktop/scripts/build-silent.ps1` (renamed to
  `build-installer.ps1`).
- `Notai_<v>_x64-silent-setup.exe` is no longer published as a separate
  release asset.

## [@notai/desktop 0.1.11] - 2026-05-08

### Changed

- **Windows installer is now fully silent on both first install and
  auto-update.**
  - **Auto-updates** (`tauri-plugin-updater`): switched
    `plugins.updater.windows.installMode` from `passive` (which still shows
    a progress UI) to `quiet`. Per `tauri-plugin-updater` source this maps
    NSIS args to `/S /R` — no UI, no prompts, restart on completion. The
    updater plugin already had `dialog: false`, so the entire update path
    is silent and automatic.
  - **First-time installs from GitHub Releases**: the standard Tauri NSIS
    installer always shows pages on double-click, so a new release asset
    `Notai_<version>_x64-silent-setup.exe` is built in CI by wrapping the
    Tauri setup in a tiny NSIS launcher (`apps/desktop/scripts/silent-wrapper.nsi`,
    `SilentInstall silent`). Double-click installs with **zero** UI: it
    extracts the inner setup to `%TEMP%`, runs it with `/S`, and launches
    the app. The original `*-setup.exe` is still uploaded for users who
    prefer the classic UI.
  - GitHub Actions: new "Build silent installer wrapper (Windows)" step in
    `release-desktop.yml` runs after `tauri-action` on the Windows runner,
    re-uses the NSIS toolchain Tauri downloaded into `%LOCALAPPDATA%\tauri\NSIS`,
    compiles the wrapper with the release version embedded, and uploads it
    to the draft release via `gh release upload --clobber`.
  - The wrapper picks up the version via `/DAPP_VERSION`; local builds via
    `apps/desktop/scripts/build-silent.ps1` now read it from
    `apps/desktop/package.json` instead of the hard-coded `0.1.0`.

## [@notai/desktop 0.1.10] - 2026-05-08

### Changed

- **Desktop sign-in is now silent.** Replaced the `notai://auth?token=…`
  deep-link round-trip (which triggered Windows' "This site is trying to
  open Notai" confirmation dialog) with a device-pairing flow:
  1. The desktop generates a 256-bit random `device` code in the renderer.
  2. It opens the system browser at `/desktop-signin?device=<code>` and
     starts polling `/api/desktop-auth/poll?device=<code>` every 2.5s.
  3. After Google sign-in, `/api/desktop-auth/issue` stores the handoff
     token under the device code and shows a "you can close this tab"
     page — no `notai://` redirect, no browser dialog.
  4. The desktop poll picks up the token and navigates the webview to
     `/api/desktop-auth/consume` to set the session cookie.
  - The button now shows a "Waiting for browser sign-in…" spinner and a
    sonner toast while polling, with a 5-minute timeout. The legacy
    deep-link path stays in `/api/desktop-auth/issue` as a fallback for
    desktop builds that haven't auto-updated yet.
- **Dev ports moved to the 15600+ range** so they don't collide with
  unrelated local services running on the common 3000 / 4040 / 5432:
  - Web (`@notai/web`): `3000` → `15600`
  - Hocuspocus realtime: `4040` → `15601`
  - Postgres (Docker compose): `5432` → `15602`
  - pgAdmin (Docker compose, optional): `5050` → `15605`
  - Updated `apps/web/package.json`, `apps/realtime-server/src/index.ts`,
    `apps/desktop/src-tauri/tauri.conf.json` (`devUrl` + main window),
    `apps/desktop/src-tauri/src/lib.rs` (`NOTAI_WEB_URL` fallback),
    `.env.local` / `.env.example`, `docker/compose.yaml`, the release
    workflow's `localhost:3000` → prod-URL rewrite (now also matches
    `15600`), `README.md`, and the OAuth setup docs.
  - **Action required:** add `http://localhost:15600/api/auth/callback/google`
    as an authorized redirect URI in the Google Cloud OAuth client (the
    old `localhost:3000` entry can be removed).
  - The released app talks to `https://notai.ro` and
    `wss://realtime.notai.ro` over 443, so nothing changes for users.

## [@notai/desktop 0.1.9] - 2026-05-07

### Fixed

- **`tauri.conf.json` schema validation broke v0.1.8 release builds on every
  platform.** `bundle.windows.nsis.allowDowngrades` is not a valid NSIS field
  in Tauri 2.x — it lives at `bundle.windows.allowDowngrades`. Moved the key
  out of `nsis`, which had been failing the build with
  `"... is not valid under any of the schemas listed in the 'anyOf' keyword"`
  and producing zero installers since v0.1.7. As a result, users were stuck on
  v0.1.7 (or earlier) and never received the OAuth/auto-update fixes shipped
  in v0.1.8.
- **Google sign-in button silently swallowed all opener errors on Windows.**
  Clicking "Continue with Google" in the desktop app appeared to do nothing
  because every failure path was caught and ignored. Rewrote the click
  handler to:
  - Try `@tauri-apps/plugin-opener` `openUrl`, then `@tauri-apps/api/core`
    `invoke('plugin:opener|open_url')`, then a final raw
    `__TAURI_INTERNALS__.invoke` fallback.
  - Recheck the Tauri globals on click (not just on mount) in case they
    were injected late.
  - Show a sonner toast with the failed URL and per-attempt error messages
    when every path fails, so the user can copy the link into a browser
    instead of seeing nothing happen.
  - Log every failed attempt to the console for support diagnosis.
- **Desktop sign-in no longer requires two clicks.** The button used to open
  the system browser at `/signin`, which then required the user to click
  "Continue with Google" a second time. New `/desktop-signin` route handler
  calls `signIn('google', { redirectTo: '/api/desktop-auth/issue' })`
  immediately, so the browser lands directly on Google's consent screen.

## [@notai/desktop 0.1.8] - 2026-05-07

### Added

- **Silent-friendly Windows installer.** New `nsis` config block in
  `tauri.conf.json` sets:
  - `installMode: currentUser` -> no UAC prompt; installs to
    `%LOCALAPPDATA%\Notai`.
  - `installerHooks: windows/hooks.nsh` -> auto-runs the previous
    version's uninstaller silently before laying down the new files
    (no "already installed, abort?" prompt; no leftover files).
  - `displayLanguageSelector: false` + `languages: ["English"]` ->
    skip the language picker dialog.
  - `allowDowngrades: true` -> reinstalling/downgrading just works.
  - `installerIcon: icons/icon.ico` -> the setup.exe shows the Notai
    icon in Explorer instead of the generic NSIS icon.
  - `compression: lzma` -> ~30% smaller installer.
- **Auto-update is now passive on Windows.** The updater plugin uses
  `installMode: passive` so updates show only a progress bar (no
  clicks, no UAC).
- **Microsoft Store auto-publish pipeline.** Added
  `publish-microsoft-store` job to `release-desktop.yml` and a
  separate `release-store-metadata.yml` workflow. Both use the
  official `microsoft/microsoft-store-apppublisher@v1.1` action via
  `msstore submission update / publish`.
- `apps/desktop/src-tauri/tauri.microsoftstore.conf.json` -> Store
  config overlay that switches Webview2 to the offline installer
  (required for Store-distributed installers).
- `apps/desktop/store/` -> Store assets folder (metadata template +
  screenshot drop zone) with a complete one-time setup README
  (Partner Center enrolment, Entra app, GitHub secrets).

### How to fully silence first-time install

The stock NSIS template still shows a 2-page wizard for users who
double-click the setup.exe. To install with zero UI, run from a shell:

```
Notai_0.1.8_x64-setup.exe /S
```

or with progress only (no clicks):

```
Notai_0.1.8_x64-setup.exe /P
```

## [@notai/desktop 0.1.7] - 2026-05-07

### Changed (CI / build infra)

- Upgraded all Node 20-based GitHub Actions to Node 24-compatible
  versions to silence the June 2026 deprecation warnings:
  - `actions/checkout@v4` -> `@v5`
  - `actions/setup-node@v4` -> `@v6`
  - `pnpm/action-setup@v4` -> `@v6`
  - `softprops/action-gh-release@v2` -> `@v3`
- Switched the Windows runner label from `windows-latest` to
  `windows-2025` to skip the auto-redirect notice.
- Cut desktop build time roughly in half by:
  - Installing only `@notai/desktop` and its devDeps
    (`pnpm install --filter @notai/desktop`) instead of the entire
    monorepo (Next.js / React / Drizzle / etc. are not needed for the
    Tauri shell).
  - Adding a per-platform `shared-key` to `swatinem/rust-cache` so
    Rust builds land on a warm `target/` directory across runs.
  - Adding `--no-install-recommends` to apt and dropping `curl`/`wget`
    (already on the runner image).
  - Setting `CARGO_INCREMENTAL=0` (faster cold compile + smaller cache).

## [@notai/desktop 0.1.6] - 2026-05-07

### Fixed

- Re-uploaded `TAURI_SIGNING_PRIVATE_KEY` and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub Actions secrets. The
  prior uploads used `gh secret set --body -`, which set the secret
  to the literal string `-` (gh CLI treats `--body -` as a literal
  value, NOT "read from stdin"). The CI build then failed with
  `Invalid symbol 45, offset 0` (45 is ASCII `-`). Fixed by piping
  to `gh secret set` without the `--body` flag at all (stdin is used
  automatically when `--body` is omitted).
- New keypair generated; `pubkey` in `tauri.conf.json` updated to match.

## [@notai/desktop 0.1.5] - 2026-05-07

### Fixed

- Re-encoded `TAURI_SIGNING_PRIVATE_KEY` GitHub secret as base64 of the
  minisign key file (tauri-action expects base64 contents, not the raw
  `untrusted comment: ...` file text). Previous build failed with
  `failed to decode base64 secret key`.

## [@notai/desktop 0.1.4] - 2026-05-07

### Fixed

- Re-issued minisign signing keypair after `0.1.3` build failed with
  `incorrect updater private key password`. The new public key is
  embedded in `tauri.conf.json` and the matching private key + password
  are stored as repository secrets `TAURI_SIGNING_PRIVATE_KEY` /
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## [@notai/desktop 0.1.3] - 2026-05-07

### Added

- **Auto-update.** On startup the app checks
  `https://github.com/dragoscv/notai/releases/latest/download/latest.json`
  for a newer version. If found, the signed installer is downloaded,
  verified against the embedded minisign public key, and applied (the
  app then restarts itself).
- Workflow signs every release with `TAURI_SIGNING_PRIVATE_KEY` and
  publishes `latest.json` plus per-platform `.sig` files alongside the
  installers, which `tauri-plugin-updater` consumes.
- Linux: only `.AppImage` updates in-place; `.deb` users still need
  apt/dpkg.

## [@notai/desktop 0.1.2] - 2026-05-07

### Fixed

- Released installers (Windows / macOS / Linux) previously opened
  `http://localhost:3000/app` because the build workflow never
  rewrote `tauri.conf.json` to the production URL. The workflow now
  swaps `localhost:3000` → `https://notai.ro` for every window before
  invoking `tauri build`.
- `NOTAI_WEB_URL` env var is now passed to `tauri-action` so the Rust
  `app_url()` helper (used by sticky + settings windows) targets prod
  too.
- Auth + database are inherited automatically: the desktop app is a
  thin webview pointing at `https://notai.ro`, so Auth.js (Google) and
  Cloud SQL run server-side just like in the browser. No desktop-side
  env vars required.

## [@notai/desktop 0.1.1] - 2026-05-07

### Fixed

- `release-desktop` workflow: drop `beforeBuildCommand` (Tauri loads remote
  URL at runtime, no need to rebuild Next inside `tauri-action`).
- `WebviewWindowBuilder::transparent(false)` removed — gated behind opt-in
  Cargo feature in tauri 2.10, broke macOS/Linux/Windows compilation.
- Skip optional Apple/Tauri signing env vars when secrets are empty;
  unsigned installers ship by default until certs are configured.

## [0.1.0] - 2026-01-15

### Added

- Initial monorepo scaffold with Next.js 16 web app, Hocuspocus realtime
  server, Tauri 2 desktop shell, shared `@notai/db`, `@notai/editor`,
  `@notai/lib`, `@notai/ui` packages.
- Drizzle schema for users, folders, notes, tags, collaborators, assets.
- Auth.js v5 with Google OAuth and Drizzle adapter.
- TipTap editor + tldraw drawing surface bound to a shared Y.Doc.
- PWA support via `@serwist/next`.
- Terraform configuration for GCP (Cloud Run, Artifact Registry,
  Secret Manager, Storage).
