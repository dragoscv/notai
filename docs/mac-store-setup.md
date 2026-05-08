# Mac App Store Submission

Notai's macOS build is published to the Mac App Store via a separate signed,
notarized, and sandboxed build. The Store rejects apps that ship their own
auto-updater, so the Store build of Notai uses the same `--no-updater` flag
as the Microsoft Store build.

## Apple Developer prerequisites

You need:

1. An Apple Developer Program membership ($99/year).
2. Two certificates from Apple, downloaded into your Keychain:
   - **Apple Distribution** (signs the app for the Store)
   - **Mac Installer Distribution** (signs the `.pkg` installer)
3. An App-Specific Password for `notarytool` (Apple ID → Sign in & Security →
   App-Specific Passwords).
4. An App Store Connect API key (Users & Access → Keys → App Store Connect API).

## Configuration

The Tauri config for the Store build lives at `src-tauri/tauri.macstore.conf.json`
(create alongside the existing `tauri.microsoftstore.conf.json`). Key fields:

```jsonc
{
  "bundle": {
    "macOS": {
      "entitlements": "macstore.entitlements",
      "providerShortName": "<YourTeamShortName>",
      "minimumSystemVersion": "12.0"
    }
  },
  "plugins": {
    "updater": { "active": false }
  }
}
```

The entitlements file must enable the App Sandbox and the Hardened Runtime, plus
any specific entitlements (clipboard, networking) the app actually uses.

## GitHub Actions workflow

A workflow at `.github/workflows/release-mac-store.yml` runs on a `v*-mac` tag
and:

1. Imports the certs from `MACOS_CERTIFICATE` (base64) using `MACOS_CERTIFICATE_PWD`.
2. Builds with `pnpm tauri build --target universal-apple-darwin --config src-tauri/tauri.macstore.conf.json`.
3. Submits the resulting `.pkg` to App Store Connect via `xcrun altool` (or the
   newer `notarytool` for stapling).

Required secrets in the repository settings:

| Secret                       | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `MACOS_CERTIFICATE`          | Base64 of the `.p12` file with both certificates          |
| `MACOS_CERTIFICATE_PWD`      | Passphrase for the `.p12`                                 |
| `MACOS_KEYCHAIN_PWD`         | Random throwaway value for the temp keychain              |
| `APPLE_ID`                   | Your Apple ID email                                       |
| `APPLE_TEAM_ID`              | 10-character Team ID                                      |
| `APPLE_APP_PASSWORD`         | App-Specific Password for `altool`                        |
| `APPSTORE_CONNECT_KEY_ID`    | API Key ID                                                |
| `APPSTORE_CONNECT_ISSUER_ID` | API Issuer ID                                             |
| `APPSTORE_CONNECT_KEY`       | Base64 of the API key `.p8` file                          |

## Release flow

1. Bump versions: `pnpm changeset` → tag `v0.X.Y-mac` and push.
2. The workflow builds + uploads. Watch the run; failures usually mean a missing
   entitlement or an unsigned dependency.
3. Open App Store Connect → Notai → submit the new build for review.
4. Apple's review averages 24–48 hours; expect occasional questions about
   sandboxing of the local SQLite + filesystem access.

## Troubleshooting

- **"App contains binary that's not signed"** — the Tauri sidecars or any third-
  party `.dylib` need to be signed too. Use `codesign --force --deep` in the
  workflow's signing step.
- **"Provisioning profile required"** — Mac App Store builds need a Mac App
  Store provisioning profile attached at build time. Generate it in the Apple
  Developer portal and reference it in the entitlements config.
- **Sandbox network access** — make sure
  `com.apple.security.network.client` is enabled in the entitlements; otherwise
  the app can't reach `notai.ro`.
