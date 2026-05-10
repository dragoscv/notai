# Notai iOS — build & submit runbook

> **Heads up:** Apple requires Xcode (macOS only). Everything below is
> safe to commit from Windows, but the actual build and upload must
> run on a Mac (M1/M2 or Intel) with Xcode 15.4+.

---

## 1. One-time per machine (Mac)

```bash
# Install Xcode from the App Store, then:
xcode-select --install
sudo xcodebuild -license accept

# Cocoapods (used by Capacitor's iOS template)
sudo gem install cocoapods
pod --version  # 1.15+
```

Sign in to Xcode with the Apple ID tied to the developer team
(Xcode → Settings → Accounts).

## 2. Generate the iOS project (run once per repo, on a Mac)

```bash
git clone <repo>
cd notai
pnpm install
cd apps/mobile
pnpm exec cap add ios
pnpm exec cap sync ios
```

This creates `apps/mobile/ios/` (gitignored after the first commit; we
treat it like `android/` — the source of truth is `capacitor.config.ts`
plus the assets / privacy manifest below).

## 3. Project settings (Xcode)

Open `apps/mobile/ios/App/App.xcworkspace` and set:

- **General → Bundle Identifier:** `app.notai.mobile`
- **Display Name:** `Notai`
- **Deployment target:** iOS 15.0
- **Signing & Capabilities:** select the team; let Xcode manage signing.
- **Capabilities to enable:**
  - Push Notifications (later, when we wire APNs)
  - Background Modes → Remote notifications (later)
  - Associated Domains → `applinks:notai.ro` (so OAuth redirects + share
    links open in-app)

## 4. App icons + splash

```bash
cd apps/mobile
pnpm assets   # uses @capacitor/assets to regenerate
pnpm exec cap sync ios
```

Source images live in `apps/mobile/assets/` (already shipped). The
Android assets pipeline reuses the same source files.

## 5. Privacy manifest (PrivacyInfo.xcprivacy)

iOS 17 requires a privacy manifest declaring SDK / API usage. Notai
uses:

- `NSPrivacyAccessedAPITypeUserDefaults` — Capacitor preferences
- `NSPrivacyAccessedAPITypeFileTimestamp` — `cap` filesystem plugin

Drop this file at `apps/mobile/ios/App/App/PrivacyInfo.xcprivacy`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key><false/>
  <key>NSPrivacyTrackingDomains</key><array/>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array><string>CA92.1</string></array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array><string>C617.1</string></array>
    </dict>
  </array>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeEmailAddress</string>
      <key>NSPrivacyCollectedDataTypeLinked</key><true/>
      <key>NSPrivacyCollectedDataTypeTracking</key><false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>
    </dict>
  </array>
</dict>
</plist>
```

## 6. Info.plist additions

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Notai uses your microphone for voice-to-note transcription.</string>
<key>NSCameraUsageDescription</key>
<string>Notai uses the camera to attach photos to notes.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Notai needs Photos access to attach images to notes.</string>
<key>NSUserTrackingUsageDescription</key>
<string>Notai does not track you across apps. This permission is shown only because Apple requires it.</string>
```

## 7. Build & ship

```bash
# Inside apps/mobile
pnpm exec cap sync ios
pnpm exec cap open ios
# In Xcode: Product → Archive → Distribute → App Store Connect → Upload
```

Or fully automated with Fastlane (set up later, separate runbook).
The repo also ships `.github/workflows/release-mobile-ios.yml` which
builds + uploads to TestFlight from a `macos-14` runner — see that
workflow header for the required GitHub secrets.

## 6.5 Share-sheet receive (parity with Android)

Android wires the OS share sheet automatically via
`AndroidManifest.xml` + `MainActivity.java`. iOS needs an
**Action Extension** plus a deep-link handler in the main app.

### Main app: handle the deep link

In `apps/mobile/ios/App/App/AppDelegate.swift`:

```swift
import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ app: UIApplication,
                     open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Hand the URL to Capacitor so the appUrlOpen JS event fires.
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }
}
```

### Add an Action Extension target in Xcode

1. **File → New → Target → Action Extension** (Swift, "Presents User Interface": no)
2. Bundle id: `app.notai.mobile.ShareExtension`
3. In the extension's `Info.plist`, set `NSExtensionAttributes`:
   ```xml
   <key>NSExtensionActivationRule</key>
   <dict>
     <key>NSExtensionActivationSupportsText</key><true/>
     <key>NSExtensionActivationSupportsWebURLWithMaxCount</key><integer>1</integer>
   </dict>
   ```
4. In the extension's `ActionViewController.swift`, replace the body with:
   ```swift
   import UIKit
   import MobileCoreServices
   import UniformTypeIdentifiers

   class ActionViewController: UIViewController {
       override func viewDidAppear(_ animated: Bool) {
           super.viewDidAppear(animated)
           guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
                 let provider = item.attachments?.first else {
               complete(); return
           }
           if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
               provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
                   if let url = item as? URL { self.openMainApp(text: url.absoluteString) }
                   self.complete()
               }
           } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
               provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
                   if let s = item as? String { self.openMainApp(text: s) }
                   self.complete()
               }
           } else {
               complete()
           }
       }

       private func openMainApp(text: String) {
           let encoded = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
           let deepLink = URL(string: "notai://quick-capture?shared=\(encoded)")!
           // Walk responder chain until we hit something that can `open(_:)`.
           var responder: UIResponder? = self
           while let r = responder {
               if let app = r as? UIApplication { app.open(deepLink); break }
               responder = r.next
           }
       }

       private func complete() {
           extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
       }
   }
   ```
5. In the **main** app target's `Info.plist`, register the URL scheme:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array><string>notai</string></array>
     </dict>
   </array>
   ```

The web layer's `appUrlOpen` listener (added in `apps/mobile`) routes
`notai://quick-capture?shared=…` to `/app/quick-capture?shared=…`,
matching the Android flow.

## 8. App Store Connect listing

The marketing copy (description, keywords, screenshots spec) lives in
`apps/mobile/store/appstore/listing.md`. Privacy URL points to
`/privacy-policy` on the production web app; support URL points to
`/contact`.

## 9. CI

We do **not** run iOS builds in CI yet — the Mac runners on GitHub
Actions are paid and slow. Until we have a TestFlight cadence, builds
happen manually from a Mac following this doc.

---

## Status (current commit)

| Item                          | State                                |
| ----------------------------- | ------------------------------------ |
| `capacitor.config.ts`         | iOS section present (`contentInset`) |
| `apps/mobile/ios/`            | NOT in repo (run `cap add ios`)      |
| Privacy manifest              | template above, drop into Xcode      |
| App icons (1024×1024 + tiles) | Generated by `pnpm assets`           |
| App Store listing copy        | `store/appstore/listing.md`          |
| Apple Developer account       | TODO (user must enrol)               |
