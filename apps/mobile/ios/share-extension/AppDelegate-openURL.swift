//
//  AppDelegate-openURL.swift
//
//  Snippet to drop into the host app's `AppDelegate.swift` (or
//  `SceneDelegate.swift` if you adopt scenes). Routes the
//  `notai://...` URL the Share Extension opened back into the
//  Capacitor webview, which the JS `CapacitorDeepLinkBridge`
//  component picks up via `App.addListener('appUrlOpen', ...)`.
//
//  Add to AppDelegate.swift:
//
//    func application(_ app: UIApplication,
//                     open url: URL,
//                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
//        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
//    }
//
//  Capacitor's ApplicationDelegateProxy already forwards the URL to
//  registered plugins; the App plugin emits `appUrlOpen`, which our
//  React bridge converts to a Next.js router push.
//
//  Also add to Info.plist (host app, NOT the extension):
//
//    <key>CFBundleURLTypes</key>
//    <array>
//      <dict>
//        <key>CFBundleURLSchemes</key>
//        <array>
//          <string>notai</string>
//        </array>
//      </dict>
//    </array>
//
