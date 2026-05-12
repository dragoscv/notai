# Mobile Release Runbook (Capacitor)

Last updated: 2026-05-11
Audience: maintainers preparing the first iOS App Store + Google Play submission.

## Current state (v1)

| Component | Status |
| --- | --- |
| Capacitor version | v6.2.1 |
| Mode | Wrapper — webview loads `https://notai.ro` (`NOTAI_MOBILE_URL` overrides) |
| App ID (both) | `app.notai.mobile` |
| Display name | `Notai` |
| iOS Info.plist + Xcode project | ⚠️ Generated on macOS via `pnpm exec cap add ios` (not committed) |
| iOS PrivacyInfo.xcprivacy | ⚠️ Template in `apps/mobile/IOS_SETUP.md`; must be added to Xcode project |
| iOS APNs / push | ⚠️ deferred (post-v1) |
| Android manifest | ✅ minimal permissions, share intent, file provider |
| Android signing | ✅ documented in `apps/mobile/android/SIGNING.md`; keystore must be generated locally |
| Android FCM (`google-services.json`) | ⚠️ deferred (post-v1) |
| Store listings | ✅ markdown templates in `apps/mobile/store/{appstore,play}/listing.md` |
| Privacy policy | ✅ live at <https://notai.ro/privacy-policy> |
| Terms of service | ✅ live at <https://notai.ro/terms> |
| Screenshots | ❌ **NOT captured** — blocking |
| Feature graphic (Play) | ❌ **NOT created** — blocking |
| Apple Developer membership | ❌ **NOT acquired** — blocking |
| Google Play Developer account | ❌ **NOT acquired** — blocking |

**Implication for v1:** all blocking items are external (paid accounts, screenshots) — no code changes can unblock them. Once those are done, the runbook below is straightforward.

## Critical path

### Week 1 — accounts + assets
1. Pay Apple Developer Program ($99/yr, requires DUNS or individual ID).
2. Pay Google Play Developer ($25 one-time).
3. Capture screenshots:
   - iPhone 6.7" (1290×2796) — at minimum: Today, a note with drawing, sidebar with folders, settings.
   - iPhone 6.5" (1284×2778) — same set, scaled.
   - iPad Pro 12.9" (2048×2732) — optional but recommended.
   - Android phone (1080×1920 or higher, 16:9 or 9:16) — same 4-6 shots.
   - Save under `apps/mobile/store/{appstore,play}/screenshots/` per existing README.
4. Create Play feature graphic 1024×500 PNG → `apps/mobile/store/play/feature-graphic.png`.

### Week 2 — iOS build
1. On macOS: `cd apps/mobile && pnpm install && pnpm exec cap add ios && pnpm sync`.
2. Open Xcode workspace (auto-opens). In project settings:
   - Bundle identifier: `app.notai.mobile`
   - Team: select your Apple Developer team
   - Capabilities: Associated Domains → `applinks:notai.ro`
3. Add `PrivacyInfo.xcprivacy` per template in `apps/mobile/IOS_SETUP.md` Section 7.
4. Add NS\*UsageDescription strings in Info.plist per template.
5. Archive (Product → Archive); upload to TestFlight.
6. Internal test on a physical device for 1 week minimum.
7. Submit for App Store review (typical turnaround: 24-48 h).

### Week 2 — Android build
1. Generate release keystore per `apps/mobile/android/SIGNING.md`.
2. `pnpm sync && pnpm --filter @notai/mobile exec cap open android`.
3. In Android Studio: Build → Generate Signed Bundle/APK → AAB.
4. Upload AAB to Play Console internal testing track.
5. Complete Data Safety form using template in `apps/mobile/store/play/listing.md`.
6. Promote to production after 24 h closed test.

### Both stores — pre-submission checklist
- [ ] Sign-in flow works in webview (Google OAuth, passkey).
- [ ] Share-to-app intent works (share text from another app → quick capture).
- [ ] Deep-link `notai://` opens the app (Android) and `applinks:notai.ro` opens app on iOS.
- [ ] Settings → Account → Delete works (GDPR / Article 15+17).
- [ ] No crashes on a clean install + first run.
- [ ] App icon renders correctly on launcher / home screen.
- [ ] Splash screen shows during cold start.
- [ ] Privacy policy URL loads on the device's default browser.

## Submission metadata locations

- App Store listing copy: `apps/mobile/store/appstore/listing.md`
- Play Store listing copy: `apps/mobile/store/play/listing.md`
- Mobile-specific privacy text: `apps/mobile/store/play/privacy.md`
- Canonical privacy policy (web): `apps/web/src/app/privacy-policy/page.tsx`
- Operator legal name: `apps/web/src/lib/legal-info.ts` (`Vlăduțescu Dragoș Cătălin`, persoană fizică, Romania)

## Known limitations of v1 mobile

- **No push notifications.** Daily review reminders only fire when the web app is open. Plan: add `@capacitor/push-notifications` + Firebase FCM + APNs in v1.1.
- **No offline mode.** Wrapper loads remote URL; loss of connectivity shows a generic error. Plan: ship a built bundle + service worker in v1.2.
- **No background sync.** Capacitor wrapper sleeps when backgrounded. Acceptable for note-taking.
- **No biometric unlock.** Web app session cookie is the only auth. Plan: `@capacitor/local-authentication` in v1.1.

## Rollback

iOS:
1. App Store Connect → Versions → Remove from sale (only if a critical bug).
2. Submit a hotfix through expedited review (request via App Store Connect; usually approved if user-impact is high).

Android:
1. Play Console → Production → Halt rollout (stops % of users receiving the broken version).
2. Upload fixed AAB → bump versionCode → submit.

## Open items (operator)

- [ ] Buy Apple Developer Program membership.
- [ ] Buy Google Play Developer account.
- [ ] Capture screenshots (4-8 per device per platform).
- [ ] Create Play feature graphic 1024×500.
- [ ] Run `pnpm exec cap add ios` on a Mac (one-time).
- [ ] Generate Android release keystore (one-time, store off-repo).
- [ ] Decide whether to ship push notifications in v1 (currently deferred).
