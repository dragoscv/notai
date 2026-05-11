# Web release — 2026-05-11 (session through `8f5fe7a`)

5 commits, all web / server / DB. No desktop bump required per
`docs/desktop-release-policy.md` — last tag `desktop-v0.1.23` remains
current; web changes ship to desktop users on next webview reload.

## Highlights

### Per-note end-to-end encryption (full slice)

- Per-note encrypt toggle: client-side AES-GCM 256 under a master key
  wrapped by both a 12+ character passphrase (PBKDF2-SHA256, 600k iters)
  and a one-time recovery key.
- Encrypted titles AND bodies — only `🔒 Encrypted note` placeholder
  ever lives in the server's `notes.title`.
- Recovery-key unlock path in the unlock dialog.
- "Change passphrase" flow that re-wraps the master key without
  touching the recovery envelope.

### E2E hardening pass (`0421366`)

Locking a note now actively wipes server-side artefacts that would
otherwise still hold readable plaintext:

- `note_versions` (manual + auto snapshots)
- `note_chat_messages`
- `flashcards`
- `notes.yjs_state` (Y.Doc binary) is set to NULL
- `notes.embedding` (pgvector) is cleared

The Hocuspocus realtime server now short-circuits both `fetch` and
`store` for encrypted notes — no plaintext mirror, no version snapshot,
no Y.Doc round-trip. The REST chat route + `listChatMessages` /
`clearChat` / `streamChatTurn` server actions all throw on encrypted
notes. The cached master key auto-relocks after 15 minutes of idle
use with a toast.

### Privacy receipts (`1103cf3`)

- New `e2e_audit_log` table (migration `0039`) recording every
  lifecycle event: setup, passphrase rotation, per-note lock / unlock /
  disable, recovery-key unlock. User-agent and IP captured.
- Settings → Security → "Encryption activity" feed renders the last
  200 events.
- Passphrase strength meter at setup and rotation (no zxcvbn dependency
  — heuristic-only). Blocks setup at score < 2.
- HIBP k-anonymity breach pre-check — only the first 5 hex chars of
  SHA-1 ever leave the browser. Blocks any non-zero appearance count.

### Bulk operations

- Sidebar bulk select supports drag-multi-move: dragging any selected
  note moves the whole selection in one `bulkUpdateNotes` call.
- Bulk "Apply tag…" action in the sidebar bulk bar.

### Graph view

- New "Hide encrypted" / "Encrypted only" toolbar toggles on
  `/app/graph`. Counter shows filtered / total.

### Canvas export

- Export canvas as SVG.
- Copy canvas to clipboard as PNG via `ClipboardItem` (with
  browser-support guard).

### Webhooks (existing surface; this session: fanout polish)

- The webhook fanout queue (`BullMQ`) was already shipped before this
  session — confirmed via memory file
  `/memories/notai-audit-doc-stale.md`. No new work this session.

### Command palette

- Module-scoped LRU cache (24 entries, 60s freshness) keyed by query +
  filter signature — repeat searches return instantly.
- "Recent searches" group rendered when the palette opens empty,
  persisted to `localStorage` (8 most-recent successful queries).

## Database

- `0036_user_keys` (set up before this session)
- `0037_note_is_encrypted` (per-note ciphertext)
- `0038_note_encrypted_title` (encrypted title)
- `0039_e2e_audit_log` (audit log) ✱ new this session

All applied locally. Production migration via
`pnpm db:migrate (production)` task with `--backup`.

## Verified clean

- `pnpm typecheck` ✔
- `pnpm lint` ✔
- Pre-push hook (secret scan + version-bump audit) ✔
