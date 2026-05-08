# Microsoft Store Submission Checklist

## Before you start

You need a Microsoft Partner Center developer account. Personal accounts are free
(US$19 one-time), company accounts are $99 — Notai ships under whichever you have.

The desktop app is built with `tauri.microsoftstore.conf.json` (the Store build
disables the auto-updater because the Store handles updates itself). The CI
workflow `.github/workflows/release-store-metadata.yml` uploads the built MSIX
artifact to a draft submission via the Partner Center API.

## Required assets

Drop these into `apps/desktop/store/microsoft/screenshots/`:

| Asset                | Pixels        | Notes                                   |
| -------------------- | ------------- | --------------------------------------- |
| Store logo (square)  | 1080 × 1080   | Reuse `apps/desktop/src-tauri/icons/icon-1024.png` |
| Hero banner          | 2400 × 1200   | Light background, single-line tagline   |
| Screenshot — main    | 1920 × 1080   | Editor with sample note                 |
| Screenshot — sticky  | 1280 × 800    | A sticky widget                         |
| Screenshot — drawing | 1920 × 1080   | Excalidraw layer in use                 |

## Listing copy

Keep `metadata.json` in this folder authoritative — the workflow reads it and
posts to Partner Center. Adjust copy there, not in the dashboard.

## Submission steps

1. Build the MSIX locally (or wait for the GitHub release tag):

   ```powershell
   cd apps/desktop
   pnpm tauri build --config src-tauri/tauri.microsoftstore.conf.json
   ```

2. Sign the MSIX with the cert provided by Partner Center (test cert is fine
   for development; production cert ships with the package).

3. Open Partner Center → Notai → **Packages** → upload the MSIX.

4. Fill in the **Properties → Age ratings** questionnaire. Notai contains:
   - No user-generated public content → no chat moderation
   - No advertising
   - Personal data: account email + content (described in privacy URL)

5. Submit for certification. Typical turnaround is 24–72 hours.

## Privacy URL

The Store certifier requires a public privacy URL even though the app is mostly
local. We host one at `https://notai.ro/legal/privacy`.

## Post-launch

- Watch the Partner Center "Health" panel for the first 7 days.
- The app's auto-updater is disabled in the Store build — releases there are
  driven by re-uploading a new MSIX with a bumped version.
