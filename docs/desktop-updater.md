# Desktop updater (Tauri 2)

The Notai desktop app uses Tauri's built-in updater. Every release built
by `.github/workflows/release-desktop.yml` is signed with a minisign
keypair, and the app polls a JSON manifest on every launch.

```
GitHub Release                                     User's Notai install
─────────────                                      ────────────────────
release-desktop.yml                                Tauri updater plugin
  → tauri-action build + sign                        → polls latest.json
    → uploads installer + .sig                       → verifies .sig with pubkey
    → uploads latest.json                            → downloads new installer
                                                     → restarts (passive install)
```

## One-time setup: generate the signing keypair

You only need to do this **once**, ever, when initialising a new app or
rotating the key. The current pubkey is already embedded in
`apps/desktop/src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

```pwsh
# Generates an encrypted minisign keypair and prints the public key + private key.
pwsh apps/desktop/scripts/generate-updater-key.ps1
```

The script writes the private key to `~/.tauri-keys/notai/notai-updater.key`
and **prints both keys to stdout once** — that is your one chance to copy
them into your password manager. The script refuses to overwrite an
existing key file.

## Configure the GitHub Actions secrets

Once you have the keypair:

```pwsh
# Private key file (the .key file the script wrote)
gh secret set TAURI_SIGNING_PRIVATE_KEY < "$HOME/.tauri-keys/notai/notai-updater.key"

# The password you chose during generation
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
# (paste the password when prompted)
```

Verify with:

```pwsh
gh secret list | Select-String TAURI
```

You should see both `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` listed.

## Update the embedded public key

If you regenerated the keypair, the printed public key MUST be base64
encoded and pasted into `tauri.conf.json`:

```jsonc
{
  "plugins": {
    "updater": {
      "active": true,
      "pubkey": "<paste-public-key-here-base64>",
      "endpoints": [
        "https://github.com/dragoscv/notai/releases/latest/download/latest.json"
      ]
    }
  }
}
```

The base64 you embed must be the entire contents of the `.pub` file
(including the comment header), base64-encoded. Tauri prints it in the
correct format already.

## Cutting a release

1. Bump `apps/desktop/package.json` `"version"` (and
   `apps/desktop/src-tauri/Cargo.toml`).
2. Update `CHANGELOG.md` under `[Unreleased]`.
3. Merge to `main`. The `Release desktop (Tauri)` workflow:
   - Detects the bump (via `scripts/detect-version-bumps.mjs`).
   - Creates a draft GitHub Release tagged `desktop-v<version>`.
   - Builds Windows / macOS-universal / Linux installers in parallel.
   - `tauri-action` signs each installer using the secrets above and
     uploads `<installer>.sig` next to it.
   - Generates `latest.json` listing every installer with its signature
     and uploads it to the same release.
   - Promotes the draft to "latest" once all platforms succeed.

## How the client checks for updates

The Tauri updater plugin (registered in `apps/desktop/src-tauri/src/lib.rs`)
runs a check on app launch and on a timer. When `latest.json` reports a
higher semver, it:

1. Downloads the platform-appropriate installer.
2. Verifies the `.sig` against the embedded `pubkey`. **A bad signature
   aborts the upgrade — no installer is run.**
3. Installs in passive mode (Windows shows only a progress bar; macOS /
   Linux replace the binary in place).
4. Restarts the app at the new version.

## Rotating the key

If the private key is ever exposed:

1. Generate a new keypair (`generate-updater-key.ps1` — delete the old
   key file first).
2. Update `pubkey` in `tauri.conf.json`.
3. Replace both GH secrets with the new private key and password.
4. **Old installs will refuse to upgrade** until the user manually
   downloads a build with the new public key. There is no remote
   "burn" mechanism. Always communicate a key rotation in release
   notes + email so users know to do a fresh install.

## Troubleshooting

- **`Error: signing key not provided` in CI** — secrets are missing or
  named wrong. Re-run `gh secret list` and verify exact names.
- **Updater finds a new version but install fails** — usually a
  signature mismatch (`pubkey` in tauri.conf.json doesn't match the
  `.key` used in CI). Regenerate from the source of truth in your
  password manager and re-paste both secret + pubkey.
- **`latest.json` not produced** — check the `tauri-action` logs for
  per-platform errors. The manifest is only generated when at least
  one platform succeeds.
