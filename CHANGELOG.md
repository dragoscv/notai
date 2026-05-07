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
