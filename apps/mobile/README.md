# @notai/mobile

Capacitor 6 wrapper that ships the Notai web experience to the **Google Play
Store** (Android) and the **Apple App Store** (iOS). The native shell loads
the production web app at `https://notai.ro` by default.

> **Why not Tauri Mobile?** Tauri's mobile targets are still preview-grade
> (Nov 2024). Capacitor's WKWebView/WebView wrappers are the fastest path to
> ship a stable v1, and the Notai PWA already works well in a webview.

---

## Prerequisites

| OS                         | Need                                        |
| -------------------------- | ------------------------------------------- |
| Build Android (any host)   | JDK 21, Android Studio + SDK 34, Gradle 8.x |
| Build iOS (macOS only)     | Xcode 15+, CocoaPods                        |
| Submit to Play Console     | Google Play developer account ($25 one-off) |
| Submit to App Store        | Apple Developer Program ($99/year)          |

The Apple/Google accounts must be created by you — Notai cannot acquire them
on your behalf.

## First-time setup

```bash
cd apps/mobile
pnpm install
# add the platform projects (creates apps/mobile/android and ios)
pnpm exec cap add android
pnpm exec cap add ios          # macOS only
pnpm sync
```

`cap add` generates the native projects — commit them once they look right.
Subsequent rebuilds:

```bash
pnpm sync                      # copies web assets + plugin updates
pnpm open:android              # launches Android Studio
pnpm open:ios                  # launches Xcode (macOS only)
```

## Pointing at a different host

```bash
NOTAI_MOBILE_URL=https://staging.notai.ro pnpm sync
```

## Sideloading on your Android phone (no store)

1. `pnpm exec cap open android` → Android Studio.
2. Plug in your phone with USB debugging enabled.
3. Run ▶ — installs `Notai-debug.apk`.
4. Or build a release APK: `Build → Generate Signed Bundle / APK`.

## Publishing — Android (Play Store)

1. In Android Studio: `Build → Generate Signed Bundle (AAB)`. Create or use
   a keystore — store it in a password manager and never commit it.
2. Open https://play.google.com/console → Create app.
3. Upload the AAB to the Internal Testing track first.
4. Fill in the listing using `apps/mobile/store/play/` as a template.
5. Promote to Production once tested.

## Publishing — iOS (App Store)

1. In Xcode: `Product → Archive` → Organizer → `Distribute App` →
   `App Store Connect`.
2. https://appstoreconnect.apple.com → My Apps → New App.
3. Fill listing using `apps/mobile/store/appstore/` as a template.
4. Submit for review.

## Pre-flight checklist (both stores)

- [ ] Privacy policy URL (already at `/legal/privacy`).
- [ ] Terms URL (already at `/legal/terms`).
- [ ] App icons in every required size — copy from `apps/web/public/icons/`
      and run platform asset generators (e.g. `@capacitor/assets`).
- [ ] At least 2 phone screenshots (1080×1920 or larger).
- [ ] Short description (≤ 80 chars), full description (≤ 4000 chars).
- [ ] Content rating questionnaire.
- [ ] Data Safety form (Play) / Privacy Nutrition Label (App Store):
      Notai stores notes, email, and account data; OAuth via Google/Apple.

## Updating later

The wrapper just hosts the web app. Every push to the web deployment is
instantly available on mobile — **no store re-submission needed for content
changes**. Submit a new build only when you bump native code, plugins, or
icons.
