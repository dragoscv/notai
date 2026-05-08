# Desktop release policy

The Notai desktop app is a Tauri shell whose main window loads
`https://notai.ro/app` (remote content). That means **most web changes
ship to desktop users automatically** the next time they reload the
window — no installer rebuild, no GitHub release.

A new desktop release **is** required only when a change touches the
native shell or the Tauri ACL surface.

## When you DO need to bump `apps/desktop/package.json`

| Surface                                    | Examples                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `apps/desktop/src-tauri/**`                | Rust code, `tauri.conf.json`, NSIS template, `hooks.nsh`, icons, plugins. |
| `capabilities/default.json`                | New permission, new `remote.urls` entry, new window label.                |
| New `@tauri-apps/plugin-*` import in `web` | Requires the plugin in `Cargo.toml` + permission in capabilities.         |
| New `invoke('plugin:foo\|bar', …)` call    | Requires `foo:allow-bar` permission.                                      |
| New custom Rust `#[tauri::command]`        | Requires the command + capability entry.                                  |
| Window flags (size, AOT, decorations)      | Set in `tauri.conf.json` or via window builder in Rust.                   |
| Auto-update / signing config               | `bundle.windows.nsis.*`, `plugins.updater.*`.                             |

When you bump the version, also add a `## [@notai/desktop X.Y.Z]` entry
to `CHANGELOG.md` (the pre-push hook enforces this).

## When you do NOT need a desktop release

- New page, route, or component under `apps/web/src/**`.
- Server actions, API routes, auth flows, DB migrations.
- Tailwind styles, copy changes, sticky-note rendering, drawing canvas.
- Anything that ships through Vercel and is rendered inside the existing
  webview.

## How it's tracked

Run the impact checker any time:

```sh
pnpm desktop:impact                  # diff vs origin/main
pnpm desktop:impact <base> [head]    # explicit range
pnpm desktop:impact --strict         # exit 1 if a bump is required
```

The same script runs as the final step of `git push` (via husky
pre-push) and prints a summary table:

- `REQUIRES desktop bump` — native files changed.
- `RECOMMEND review` — web files reference the Tauri ACL surface; only
  matters if the reference is new.
- `Web-only change` — ships on next webview reload, no action needed.

It's informational by default (does not block the push). Add `--strict`
when you want CI to fail on missed bumps.

## Versioning

Each app is versioned independently — see the table at the top of
`CHANGELOG.md`. The desktop CI (`release-desktop.yml`) cuts a release
whenever `apps/desktop/package.json` version changes on `main`.
