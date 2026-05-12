# Desktop Release Runbook (Tauri)

Last updated: 2026-05-11
Audience: maintainers cutting a desktop release.

## Current state (v1 launch)

| Component | Status |
| --- | --- |
| Tauri version | v2.1 |
| Auto-updater (minisign) | ✅ wired, signed, hosted on GitHub Releases |
| GitHub Actions release workflow | ✅ `release-desktop.yml` builds Win/macOS/Linux on tag push |
| Windows Authenticode signing | ❌ **NOT configured** — installers ship unsigned (SmartScreen warning on first run) |
| macOS notarization | ❌ **NOT configured** — Gatekeeper will block direct `.dmg` download |
| Mac App Store | ❌ docs only (`docs/mac-store-setup.md`); workflow not implemented |
| Microsoft Store | ⚠️ workflow scaffolded but `if: false` |
| Linux .AppImage / .deb / .rpm | ✅ unsigned but acceptable |
| CSP on webview | n/a — webview loads production web app, web CSP applies |

**Implication for v1:** users on Windows will see "Windows protected your PC" on first install (require "More info → Run anyway"). Users on macOS will need to right-click → Open the first time, OR `xattr -d com.apple.quarantine /Applications/Notai.app`.

This is acceptable for **early access / beta**, NOT for a paid public launch.

## Cutting a release (today)

1. Bump `apps/desktop/package.json` version (and `apps/desktop/src-tauri/tauri.conf.json` `version`).
2. Update `apps/desktop/CHANGELOG.md` if present.
3. Commit + push to `main`. The workflow picks up `apps/desktop/package.json` change and triggers `release-desktop.yml`.
4. Workflow:
   - Builds on `windows-2025`, `macos-14`, `ubuntu-22.04`.
   - Signs updater bundles with minisign (`TAURI_SIGNING_PRIVATE_KEY`).
   - Creates draft GitHub Release `desktop-v<VERSION>`.
   - Promotes to "latest" with rendered Markdown table of downloads.
5. Verify `latest.json` in the published release contains all platforms + signatures.
6. Test the auto-updater: install previous version, launch, wait 30s — toast should appear.

## Verification checklist (post-release)

- [ ] Download Windows `.exe` from release; install on a clean Windows machine.
- [ ] Download macOS `.dmg`; install on a Mac. (Right-click → Open the first time.)
- [ ] Download Linux `.AppImage`; chmod +x; run.
- [ ] Verify global shortcut (Cmd/Ctrl+Shift+N) opens quick-capture sticky.
- [ ] Verify deep-link `notai://test` opens the app.
- [ ] Verify auto-updater offer appears on the previous version.

## Path to production-grade signed builds

### Windows Authenticode

**Option A — Azure Trusted Signing** (recommended; cheapest for new orgs)
- ~$10/mo, no hardware token, works with GitHub Actions
- Setup: <https://learn.microsoft.com/azure/trusted-signing/quickstart>
- Add to workflow:
  ```yaml
  - uses: azure/trusted-signing-action@v0.4.0
    with:
      azure-tenant-id: ${{ secrets.AZURE_TENANT_ID }}
      azure-client-id: ${{ secrets.AZURE_CLIENT_ID }}
      azure-client-secret: ${{ secrets.AZURE_CLIENT_SECRET }}
      endpoint: https://eus.codesigning.azure.net/
      trusted-signing-account-name: <your-account>
      certificate-profile-name: <your-profile>
      files-folder: ${{ runner.temp }}/notai-windows
      files-folder-filter: exe,msi
  ```

**Option B — EV cert from a CA** (Sectigo, DigiCert, GlobalSign)
- $200-600/yr, hardware token (HSM) required → CANNOT be used in GitHub-hosted runners directly. Use a self-hosted runner OR signing service (SignPath, Garantir).

### macOS notarization (for direct download)

Required artifacts:
- Apple Developer Program membership ($99/yr)
- Developer ID Application certificate (`.p12` exported from Keychain)
- App-specific password from <https://appleid.apple.com>

Add secrets:
```
APPLE_CERTIFICATE          ← base64 of .p12
APPLE_CERTIFICATE_PASSWORD ← .p12 password
APPLE_ID                   ← apple-id email
APPLE_PASSWORD             ← app-specific password
APPLE_TEAM_ID              ← e.g. AB12CD34EF
```

Add env block to the macOS job in `release-desktop.yml`:
```yaml
env:
  APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
  APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  APPLE_SIGNING_IDENTITY: "Developer ID Application: Codai SRL (TEAMID)"
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

Tauri-action will pick these up automatically and run `codesign` + `notarytool submit --wait` + `xcrun stapler staple`.

### Mac App Store

Out of scope for v1. See `docs/mac-store-setup.md` for the implementation plan when ready.

### Microsoft Store

Out of scope for v1. Toggle `publish-microsoft-store` job from `if: false` once first manual submission is done. See `docs/microsoft-store-setup.md`.

## Bundle identifier note

Currently `dev.notai.desktop` (dev-prefixed). Acceptable for direct downloads; **must change** before App Store / Microsoft Store submission to a real reverse-DNS (e.g. `ro.notai.desktop` or `com.codai.notai`). Changing the identifier post-launch will:
- Break the auto-updater (different identifier = different app to the OS)
- Wipe local app data on Windows/macOS

Plan: change identifier in v1.0 final, before public launch, with a one-time migration note.

## Rollback

If a release ships broken updates:
1. In GitHub Releases, edit the broken release → uncheck "Latest".
2. Find the previous good release → check "Set as latest".
3. The updater plugin queries `releases/latest/download/latest.json` so updating "latest" rolls everyone back.
4. Bump version + push fix; new release auto-promotes.

## Open items (operator)

- [ ] Decide between Azure Trusted Signing vs EV cert for Windows.
- [ ] Buy Apple Developer Program membership.
- [ ] Generate Developer ID Application cert; export to `.p12`; add base64 to `APPLE_CERTIFICATE` GitHub secret.
- [ ] Decide final bundle identifier; change once before public launch.
- [ ] Set CSP on webview if/when desktop app stops loading remote production web app.
