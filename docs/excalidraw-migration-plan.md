# Excalidraw migration plan — making the canvas canonical

> Status: Phase 1 in progress (this release). Phase 2 + 3 queued.
> Owner: @vladu. Last updated: 2026-05-09.

## Why

Notai's wedge is *visible thinking*. Notion-like rich text on a flat
page is a commodity; a freeform spatial canvas where every artifact
(text, drawing, math, sticky, image, embed) lives at a point in 2D
space is not. We've been running a hybrid for months — Excalidraw
underneath, TipTap text blocks floating on top — and the seam shows:

- Two editors fight for input focus and selection.
- Slash menus, formatting, comments, math, mermaid only exist in the
  TipTap layer; users drawing on the canvas have a strictly poorer
  experience.
- Block ⇄ scene coordinate sync is fragile; bugs around scrolling,
  zoom, sticky notes, and read-only mirrors recur.
- Bundle pays for both editors; mobile suffers most.

Decision: **Excalidraw is the canonical surface for notes and stickies.
TipTap survives only on non-note surfaces** (chat panel, comments,
quick-capture, support tickets, Ask page) where flat prose is the right
primitive.

## Phase 1 — Foundation (this release)

Goal: stop the bleeding without breaking any existing note.

- [x] **Excalidraw-native Calc** (`packages/editor/src/excalidraw-calc.ts`) — Apple Math Notes parity on the canvas itself. Diff-and-apply reconciler with `customData.calcResultOf` so result elements are owned by the plugin and never collide with user edits.
- [x] **Meeting Mode panel** (`apps/web/src/components/note/meeting-mode-panel.tsx`) — uses the canvas-first model: enhanced markdown is inserted into whichever surface the user has open (canvas via Excalidraw text element pasting, or legacy TipTap block via existing `insertContent`).
- [x] **New notes open as pure Excalidraw** — `migrateLegacyDoc()` no longer auto-seeds an empty TipTap block. Brand-new notes get zero blocks, so the user sees the canvas immediately.
- [x] **Per-note migration action** — `migrateBlocksToExcalidraw(doc)` walks each block, extracts plaintext, creates positioned Excalidraw `text` elements, removes the blocks. Idempotent. Wired to a "Convert text blocks to Excalidraw…" item in the note menu with a confirm dialog.
- [x] **Calc on legacy TipTap blocks** (`calc-extension.tsx`) — equal capability for un-migrated notes so users aren't punished for not migrating yet.

## Phase 2 — Reimplement structured blocks on Excalidraw (next 2-3 sprints)

Goal: the migration is no longer lossy. Every formatting affordance the
TipTap layer offered must have an Excalidraw-native equivalent.

Inventory of what we lose if a user migrates today:

| TipTap feature           | Excalidraw plan                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Headings (H1/H2/H3)      | Bigger `fontSize` + bold `fontFamily`. Add a "Heading" tool in toolbar that creates a 28px / 22px / 18px text element. Style preset tag in `customData.style: 'h1'` for downstream theming.                                                                                                                                                                                |
| Bold / italic / strike   | Excalidraw's text element doesn't support inline runs. Two paths: (a) accept block-level styling only (whole text element bold) — simplest; (b) overlay a custom renderer that parses `**bold**` markdown. Decision: ship (a) first via a "Bold" toggle in the text props panel; (b) is Phase 2.5 if users ask.                                                          |
| Bullet / numbered lists  | Custom element type `customList` in `customData`. Renders as a text element with auto-prefixed `• ` or `1. ` per line. Enter at end inserts new line with prefix.                                                                                                                                                                                                         |
| Checkboxes               | Pair an Excalidraw rectangle (bound element) per line with the text. Click toggles `customData.checked`. Renders ☐/☑.                                                                                                                                                                                                                                                  |
| Code block               | New element type via `customData.kind: 'code'`. Monospace font + light bg fill. Copy button in floating toolbar.                                                                                                                                                                                                                                                          |
| Math (KaTeX)             | Already shipped Calc. For display equations, render KaTeX → SVG offscreen, embed as Excalidraw image element with `customData.mathSource`. Double-click reopens the source.                                                                                                                                                                                              |
| Mermaid                  | Same pattern — render Mermaid → SVG, embed as image, store source in `customData.mermaidSource`. Excalidraw already has Mermaid import in its UI; lean on it.                                                                                                                                                                                                            |
| Callouts                 | Rounded rectangle with a tinted fill + an icon text element grouped together. Slash menu "Callout" creates the group.                                                                                                                                                                                                                                                  |
| Toggles / collapsible    | Defer. Excalidraw is spatial; collapsing is conceptually an outline affordance. P3.                                                                                                                                                                                                                                                                                       |
| Backlinks `[[Note]]`     | Custom text element renderer with a clickable link icon overlay. Match against note title/id. Hover preview.                                                                                                                                                                                                                                                              |
| Tables                   | Defer. Excalidraw doesn't do tables; if users need them they go to a database (P3 feature). For now, "convert table to plain text grid" during migration.                                                                                                                                                                                                                |
| Slash menu               | Reuse the existing menu component. Trigger on `/` keystroke when an Excalidraw text element is being edited; insert via Excalidraw API.                                                                                                                                                                                                                                  |
| Comments on blocks       | Switch anchor from `{kind:'block', blockId}` to `{kind:'element', elementId}`. Comments panel filters by selected Excalidraw element.                                                                                                                                                                                                                                   |
| Drag handle / reorder    | Excalidraw is spatial — drag is native. No-op.                                                                                                                                                                                                                                                                                                                            |

Implementation order (deliver value early):

1. **Slash menu on Excalidraw text** + **headings preset** (1 week). Unblocks "I want to type fast and structure later".
2. **Backlinks** (3 days). Critical for PKM users.
3. **Math display + Mermaid** (1 week). Re-uses Phase-1 Calc plumbing.
4. **Lists + checkboxes** (1 week). The most-missed feature in user feedback.
5. **Callouts + code blocks** (3 days).
6. **Comments rewire** (3 days).

Done-criteria for Phase 2: a fresh user creates a note, uses every
feature above on the canvas, never sees a TipTap block, and the
roundtrip through migration of an existing power-user note loses
nothing visible.

## Phase 3 — Delete TipTap from notes (1 sprint after Phase 2)

- Remove `text-block.tsx` and the canvas-overlay rendering from `canvas-note.tsx`.
- Remove `BLOCKS_KEY` / `BLOCKS_CONTENT_MAP` writes; keep read-only legacy support behind a feature flag for one release in case a user has an old offline doc.
- Remove `@tiptap/*` deps from `packages/editor/package.json`. Keep them in `apps/web` for chat / comments / Ask / quick-capture / support.
- Bundle audit: expect `@notai/web` first-load JS to drop ~120-180 KB gzipped (TipTap core + StarterKit + the extensions specific to notes).
- CHANGELOG entry: "Removed: TipTap from notes (canvas is canonical)".

### Phase 3 — current status

- **Step 0 — kickoff (this release)**: dismissible "Convert to canvas" banner shipped on every note that still has TipTap blocks. Drives voluntary adoption ahead of any destructive removal. Tracks dismissal per-note via localStorage.
- **Step 1 (next)**: when telemetry shows the banner conversion rate has plateaued, ship a *second* banner ("These blocks are read-only. Convert to keep editing.") and switch the BlockFrame `interactive` prop to `false` for any unmigrated notes.
- **Step 2**: stop rendering the BlockFrame layer. Legacy data still reachable via Y history; notes with un-migrated blocks show a one-button "Recover plaintext" button that runs `migrateBlocksToExcalidraw(doc)` server-side.
- **Step 3**: delete `text-block.tsx`, `backlink-extension.ts`, `callout-extension.ts`, `toggle-extension.ts`, `math-extension.ts`, `mermaid-extension.ts`, `calc-extension.tsx`, `slash-menu-extension.ts`, `toolbar.tsx` from `packages/editor`. Drop `@tiptap/*` from `packages/editor/package.json`. Apps that still need TipTap (chat, comments, Ask, quick-capture, support) own their deps directly in `apps/web/package.json`.
- **Step 4**: bundle audit + CHANGELOG entry "Removed: TipTap from notes".

## Risks + mitigations

| Risk                                                            | Mitigation                                                                                                                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User migrates a richly-formatted note and feels "downgraded"    | Phase 2 is gated on Phase 2 actually closing every gap. Migration prompt warns + lists what will collapse. Easy "undo migration" via Y history within 24h.                  |
| Excalidraw upstream changes break our custom elements           | Pin `@excalidraw/excalidraw` minor; integration tests for `customData` round-tripping; keep the diff-and-apply pattern (we never trust scene state, we reconcile to it).      |
| New Calc/structured-block features cost more bundle than TipTap | Lazy-import every renderer (KaTeX, Mermaid, mathjs already lazy). Net should still be lower because TipTap StarterKit is heavy.                                              |
| Sticky-note read-only mirrors regress                           | They already use `useExcalidrawCalc(api, !readOnly)` — same pattern for every Phase-2 plugin: hook takes an `enabled` flag, stickies pass `false` for write-side reconcilers. |
| Comments anchored to blockIds become orphaned                   | Migration creates `text-{blockId}` element ids; rewire `comments` table's `anchor` column in a one-shot SQL migration mapping `{kind:'block', blockId}` → `{kind:'element', elementId: 'text-' + blockId}`. |

## What's explicitly out of scope

- Mobile-native canvas redesign. Deferred to a separate plan; the
  current touch handling on Excalidraw is acceptable for read + light
  edit.
- Database/table primitive. Outside the visible-thinking thesis; if it
  ships at all, it's a sidebar over the canvas, not on it.
- Realtime collaborative cursors on individual elements. Excalidraw
  already gives us scene-level presence; element-level is polish (P3).
