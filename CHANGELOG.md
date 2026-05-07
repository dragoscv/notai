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
