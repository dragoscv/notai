# Notai Web Clipper

Cross-browser (Chrome/Edge/Firefox) extension that saves the current page or selection
into your Notai workspace.

## Building / Loading (development)

This is a plain MV3 extension — no bundler. Load it unpacked:

1. Visit `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** → pick this folder.
4. Open the popup → **Settings** → paste your API URL and Personal Access Token.

## Generating a Personal Access Token

In the Notai web app: **Settings → Integrations → Web clipper → Create token**.
Tokens are scoped to capture-only and can be revoked any time from the same screen.

## Endpoints used

- `POST /api/clipper` — save a clipped item as a new note.
- `GET  /api/clipper/whoami` — verifies the token and returns the linked user.

## Publishing

- **Chrome Web Store**: zip this folder, upload via the developer dashboard.
- **Firefox AMO**: the manifest is mostly compatible; replace `service_worker` with
  `background.scripts` for a Firefox-specific build (already abstracted via the
  `commands` API).
- **Edge Add-ons**: re-use the Chrome zip.

## Icon assets

Put 16/32/48/128 px PNGs into `icons/`. The Notai brand mark works well — same
warm-amber on transparent background as the desktop app.
