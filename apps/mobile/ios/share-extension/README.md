# iOS Share Extension

Canonical source files for the Notai iOS Action (Share) Extension.
These live in the repo so they survive `cap add ios` (which
otherwise generates a brand-new Xcode project).

## Files

- **`ActionViewController.swift`** — the extension entry point. Reads
  the Share Sheet payload (URL / plain text / web page selection)
  and opens `notai://quick-capture?shared=<url-encoded>` in the host
  app.
- **`Info.plist`** — the extension's Info.plist. Declares which
  Share Sheet payload types are accepted via
  `NSExtensionActivationRule`.
- **`AppDelegate-openURL.swift`** — snippet to paste into the host
  app's `AppDelegate.swift` to register the `notai://` URL scheme
  and forward incoming URLs to Capacitor (where
  `CapacitorDeepLinkBridge` routes them through the Next.js router).

## How it gets used

Once `cap add ios` has been run on a Mac and Xcode is open, follow
the runbook at `apps/mobile/IOS_SETUP.md` Section 6.5. In short:

1. In Xcode: **File → New → Target → Share Extension** (name it
   `NotaiShareExtension`).
2. **Replace** the auto-generated `ActionViewController.swift` with
   the file in this folder.
3. **Replace** the auto-generated `Info.plist` with the file in this
   folder.
4. **Paste** the contents of `AppDelegate-openURL.swift` into the
   host app's `AppDelegate.swift` and the `CFBundleURLTypes` block
   into the host app's `Info.plist`.
5. Build & run on a device. Long-press a link in Safari → tap the
   share icon → tap **Notai** → the host app opens directly into
   the quick-capture page with the URL pre-filled.

The matching JS bridge is at
[`apps/web/src/components/mobile/capacitor-deep-link-bridge.tsx`](../../web/src/components/mobile/capacitor-deep-link-bridge.tsx).
