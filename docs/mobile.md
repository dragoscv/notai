# Mobile (iOS / Android)

Notai targets two mobile experiences:

1. **Installable PWA** (zero-install, instant updates) — recommended for
   power users on iOS 16+ and modern Android.
2. **Capacitor wrapper** (`apps/mobile`) — published to the Play Store and
   App Store. The wrapper loads the production web URL inside a native
   webview, so app updates ship without store re-submission.

Tauri Mobile is **no longer the official path** — Capacitor's
WKWebView/WebView wrappers are far more stable as of late 2024. The Tauri
desktop targets remain unchanged.

## Installable PWA

The web app already ships:

- `apps/web/public/manifest.webmanifest` — full PWA manifest with shortcuts,
  share target, and icons sized 32–1024px.
- `display_override: ["window-controls-overlay", "standalone"]` — installs as a
  proper standalone window on desktop and full-screen on mobile.
- `share_target` — the user can share text/URLs from any other app *into*
  Notai; the share lands at `/app?share=1` which opens a pre-filled new note.

To install on iOS: open `notai.ro` in Safari → Share → **Add to Home Screen**.
On Android: Chrome's address bar shows "Install Notai" once the manifest is
seen on at least two visits.

## Capacitor wrapper (publish to stores)

For App Store / Play Store distribution, see [`apps/mobile/README.md`](../apps/mobile/README.md).
Quick path:

```bash
cd apps/mobile
pnpm install
pnpm exec cap add android        # any host
pnpm exec cap add ios            # macOS only
pnpm sync
pnpm open:android                # Android Studio → Run on device
pnpm open:ios                    # Xcode → Archive
```

Store listing templates live under `apps/mobile/store/play/` and
`apps/mobile/store/appstore/`.

## Tauri Mobile (legacy preview)

The Tauri 2 mobile target is wired up in `apps/desktop/src-tauri`:

```bash
cd apps/desktop
pnpm tauri ios init       # generates the Xcode project
pnpm tauri android init   # generates the Gradle project
pnpm tauri ios dev        # iOS simulator
pnpm tauri android dev    # Android emulator / device
```

Caveats today (track in the public roadmap):

- The drawing canvas (`@notai/editor`'s tldraw layer) needs touch tuning.
- Quick-capture global hotkey is desktop-only; on mobile we rely on the OS
  share sheet.
- The realtime websocket reconnects more aggressively on mobile (background
  taps lose the socket); we already fall back to IndexedDB queue on disconnect.

## Targets

| Platform        | Status     | Notes                                       |
| --------------- | ---------- | ------------------------------------------- |
| iOS 16+ PWA     | ✅ shipping | Add-to-Home-Screen, share target            |
| Android PWA     | ✅ shipping | Same manifest                               |
| Tauri iOS       | 🧪 preview | Build green, UX still desktop-shaped        |
| Tauri Android   | 🧪 preview | Build green                                 |
| App Store / Play| ⏸️ later   | Will follow the desktop store launches      |
