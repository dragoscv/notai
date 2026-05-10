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
