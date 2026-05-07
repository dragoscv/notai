# Microsoft Store publishing — Notai

## What this folder contains

- `microsoft/metadata.json` — Store listing fields (description, keywords, etc.). Edit and push to update the live listing automatically.
- `screenshots/` — required Store screenshots (drop PNGs here, see naming below).

## Required screenshots

Microsoft Store **requires at least 1, accepts up to 9** screenshots per language. All must be PNG, 16:9 or 16:10 ratio, minimum 1366x768.

Recommended set for Notai (drop into `apps/desktop/store/screenshots/`):

| File | Suggested content | Size |
|---|---|---|
| `01-app-main.png` | Notai main window with a few notes open | 1920x1080 |
| `02-sticky-notes.png` | Several sticky notes floating over a desktop | 1920x1080 |
| `03-drawing.png` | The drawing canvas mid-sketch | 1920x1080 |
| `04-pdf-import.png` | PDF imported with annotations | 1920x1080 |
| `05-collab.png` | Two cursors collaborating in real time | 1920x1080 |

To capture: run `pnpm --filter @notai/desktop dev`, set up the scenes, take a screenshot with **Win+Shift+S** (Snipping Tool), save as PNG.

## One-time manual setup

You only need to do this ONCE per app, ever.

### 1. Enrol as a Microsoft Partner Center developer
- Go to https://partner.microsoft.com/dashboard
- Pay the one-time fee (~$19 individual / $99 company)
- Complete identity verification

### 2. Reserve the app name + create the MSI/EXE app
- Partner Center → **Apps and games** → **New product** → **EXE or MSI app**
- Reserve the name **Notai**
- Fill in the **first submission manually** (this is required by MS before the API can take over):
  - Pricing & availability: Free, all markets
  - Properties: Category = Productivity, age rating questionnaire
  - Packages: link to `https://github.com/dragoscv/notai/releases/latest/download/Notai_x.y.z_x64-setup.exe` (use the latest released version number)
  - Store listings: copy from `metadata.json` (description, screenshots, etc.)
  - Submit for certification
- After it goes live, copy the **Store ID** (looks like `9XXXXXXX`) — you need this for the workflow.

### 3. Create an Entra ID app registration
- Go to https://entra.microsoft.com → **App registrations** → **New registration**
- Name: `notai-store-publisher`
- Supported account types: Single tenant
- Click Register, copy:
  - **Application (client) ID** → `MS_STORE_CLIENT_ID`
  - **Directory (tenant) ID** → `MS_STORE_TENANT_ID`
- Go to **Certificates & secrets** → **New client secret** → copy the **Value** → `MS_STORE_CLIENT_SECRET`

### 4. Link the Entra app to Partner Center
- Partner Center → **Account settings** → **User management** → **Microsoft Entra applications** → **Add Microsoft Entra application**
- Select `notai-store-publisher` → assign role **Manager**

### 5. Get your Seller ID
- Partner Center → **Account settings** → **Identifiers** → copy the **Seller ID** (numeric) → `MS_STORE_SELLER_ID`

### 6. Add GitHub secrets
In your repo Settings → Secrets and variables → Actions, add:

| Secret name | Value source |
|---|---|
| `MS_STORE_TENANT_ID` | Entra tenant ID |
| `MS_STORE_CLIENT_ID` | Entra app application ID |
| `MS_STORE_CLIENT_SECRET` | Entra app client secret value |
| `MS_STORE_SELLER_ID` | Partner Center seller ID |
| `MS_STORE_PRODUCT_ID` | Store ID of the reserved Notai app (e.g. `9XXXXXXX`) |

### 7. Capture the live metadata schema
This is a one-shot to seed `metadata.json` with the exact JSON structure the Store API expects:

```bash
gh workflow run "Microsoft Store: get base metadata"
```

Then watch the run, copy the printed JSON, paste it into `apps/desktop/store/microsoft/metadata.json`, edit the descriptive fields, and commit. From now on **every push to `apps/desktop/package.json`** will auto-publish a new version (binary URL) AND **every push to `metadata.json`** will auto-publish updated text/screenshots.

## How auto-publishing works

The `release-desktop.yml` workflow has a `publish-microsoft-store` job that:

1. Runs after the Windows build succeeds
2. Installs the `msstore` CLI via `microsoft/microsoft-store-apppublisher@v1.1`
3. Authenticates with the Entra app credentials
4. Updates the package URL in the Partner Center submission to point at the new release `.exe`
5. Submits for certification (typically takes a few hours)

A separate workflow `release-store-metadata.yml` updates the listing text/images when `apps/desktop/store/microsoft/metadata.json` or `apps/desktop/store/screenshots/**` changes.

## Notes & gotchas

- **First submission MUST be manual** — the API can only update existing submissions, not create new apps.
- **Free apps only** for now — Microsoft has not yet enabled paid app updates via the API.
- **Webview2 offline installer** is required by the Store; the workflow uses `tauri.microsoftstore.conf.json` (offlineInstaller mode) which adds ~127MB to the installer.
- Builds for the Store keep the same auto-update endpoint, so users get updates from GitHub Releases (Microsoft just lists/discovers your app).
