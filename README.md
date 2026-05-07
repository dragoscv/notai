# Notai

> A calm, collaborative notes app with drawing, lists, and desktop sticky notes.
> Built for focus — optimized for ADHD brains that need their thoughts visible.

<p>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19.2-61dafb" />
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-orange" />
  <img alt="Drizzle" src="https://img.shields.io/badge/Drizzle-ORM-green" />
  <img alt="Yjs CRDT" src="https://img.shields.io/badge/Yjs-CRDT-purple" />
</p>

## ✨ Features

- 📝 **Rich text + lists** — TipTap editor with headings, checkboxes, code blocks, highlights
- 🖊️ **S Pen drawing** — pressure-sensitive canvas (tldraw) with palm rejection
- 🔄 **Realtime sync** — open a note on any device, they stay in sync (Yjs CRDT + Hocuspocus)
- 📴 **Offline-first** — IndexedDB persistence; edits sync when reconnected
- 📌 **Sticky notes on desktop** — Tauri app with always-on-top, multi-window, system tray
- 📱 **Installable PWA** — works on Galaxy phones with S Pen, Android, iOS, desktop browsers
- 🌓 **Light + dark** — thoughtful OKLCH palette, warm paper tones
- 🔐 **Google sign-in** — Auth.js v5 with Drizzle adapter, session cookies only
- ⌨️ **Keyboard-first** — `⌘K` command palette, `⌘N` quick-create

## 🗺️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      apps/desktop (Tauri 2)                │
│  Rust host + multi-window always-on-top + system tray      │
│  Loads the web app in each window                          │
└──────────────────────────┬─────────────────────────────────┘
                           │  http/https
┌──────────────────────────▼─────────────────────────────────┐
│              apps/web  (Next.js 16 + PWA)                  │
│  RSC · Server Actions · Auth.js · Cache Components         │
│  TipTap + tldraw bound to shared Y.Doc                     │
└────────┬─────────────────────────────────┬─────────────────┘
         │ wss                             │ sql
┌────────▼──────────────┐        ┌─────────▼─────────┐
│ apps/realtime-server  │        │  Postgres (Neon)  │
│   (Hocuspocus + Yjs)  │───────▶│  Drizzle schema   │
└───────────────────────┘        └───────────────────┘

packages/
├── db        Drizzle schema + client
├── editor    TipTap + tldraw bound to Y.Doc
├── lib       env, utils, JWT for realtime
└── ui        shadcn components + theme
```

## 🚀 Quick start (local dev)

**Prereqs**: Node 22, pnpm 10, Docker Desktop, (optional) Rust toolchain for the desktop app.

```powershell
# 1. Install
pnpm install

# 2. Copy env
Copy-Item .env.example .env.local
# Edit .env.local:
#   - AUTH_SECRET: pnpm dlx auth secret
#   - HOCUSPOCUS_JWT_SECRET: any 32+ random bytes
#   - AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET: see docs/setup-google-oauth.md

# 3. Start Postgres
pnpm docker:up

# 4. Push the schema
pnpm db:generate
pnpm db:push
# (optional) pnpm db:seed

# 5. Run it all (web + realtime)
pnpm dev
```

Open http://localhost:3000 and sign in.

### Desktop app (Tauri)

```powershell
# Prereqs: https://tauri.app/start/prerequisites/ (Rust, WebView2, Build Tools)
# Generate icons from a 1024x1024 source:
pnpm --filter @notai/desktop tauri icon path/to/source.png
# Dev:
pnpm dev:desktop
# Production bundle (.msi / .exe on Windows):
pnpm --filter @notai/desktop build
```

### PWA install

- **Samsung Internet / Chrome on Android**: tap the menu → *Install app*. S Pen works out of the box (the editor listens to `PointerEvent.pressure` and `tiltX/Y`).
- **Desktop Chrome/Edge**: click the install icon in the address bar.

## 🧰 Scripts

| Script              | What                                               |
| ------------------- | -------------------------------------------------- |
| `pnpm dev`          | Run web + realtime in parallel (Turborepo)         |
| `pnpm dev:web`      | Just Next.js                                       |
| `pnpm dev:realtime` | Just Hocuspocus                                    |
| `pnpm dev:desktop`  | Launch Tauri (starts the web dev server)           |
| `pnpm db:studio`    | Browse your DB with Drizzle Studio                 |
| `pnpm docker:up`    | Start Postgres (and optional pgAdmin via profile)  |
| `pnpm lint`         | ESLint across the monorepo                         |
| `pnpm typecheck`    | TS strict mode across every package                |

## 🚢 Deploying to production

See [`infra/terraform/README.md`](./infra/terraform/README.md) for the full Terraform
setup. TL;DR: Artifact Registry + two Cloud Run services + Secret Manager + Neon.

**Manual steps on your side (one-time):**

1. [Create Google OAuth credentials](./docs/setup-google-oauth.md)
2. Create a free [Neon project](https://console.neon.tech) and copy the pooled URL
3. Point a domain to the Cloud Run service via the domain mapping output

## 📁 Project structure

```
mynotes/
├── apps/
│   ├── web/              Next.js 16 PWA
│   ├── realtime-server/  Hocuspocus websocket server
│   └── desktop/          Tauri 2 desktop shell
├── packages/
│   ├── db/               Drizzle schema + client
│   ├── editor/           TipTap + tldraw + Yjs
│   ├── lib/              env, utils, JWT
│   └── ui/               shadcn components + theme
├── docker/               Local dev (Postgres, pgAdmin)
├── infra/terraform/      GCP infra
└── docs/                 Setup guides
```

## 🧠 Design decisions

- **Yjs over Liveblocks/Partykit**: self-hosted, no vendor lock-in, works offline for free.
- **Neon over Cloud SQL**: scales to zero, branching for previews, ~$0/mo at your usage.
- **Tauri 2 over Electron**: ~3 MB binary vs ~150 MB, real native windows, Rust safety.
- **tldraw over custom canvas**: battle-tested S Pen support, pressure, palm rejection.
- **Terraform over Pulumi**: mature GCP provider, HCL simpler for this scope.
- **Drizzle over Prisma**: SQL-first, smaller bundle, better for edge/serverless runtimes.

## 📜 License

MIT · © 2026 Dragos
