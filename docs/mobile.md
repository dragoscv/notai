# Mobile (iOS / Android via Tauri 2)

Notai's desktop app uses Tauri 2, which has experimental but usable mobile
targets. Until the mobile UI is fully redesigned for touch, the official
mobile experience is the **PWA** — installable from the browser on iOS 16+
and any modern Android.

## Installable PWA (recommended for now)

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

## Native mobile (preview)

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
