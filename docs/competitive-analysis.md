# Competitive analysis — Notai vs. the notes universe

> Goal: be the calmest, fastest, most "always-visible" notes app on the market —
> better for an ADHD brain than Notion, OneNote, Obsidian, Apple Notes, Keep,
> Outlook, Evernote, Bear, Mem, Reflect, Logseq, Craft, Capacities, Tana, or
> Anytype. We don't need to win on every axis; we need to win on the axes our
> users feel daily.

Last updated: 2026-05-09. Owners: @vladu. This is a living doc — update it
when a competitor ships something we should react to, or when we close a gap.

---

## 1. The market in one paragraph

The notes space has fractured into five archetypes:

1. **All-in-one workspaces** — Notion, Craft, Coda, Anytype. Rich blocks,
   databases, slash menus, AI, sharing. Heavy, slow, "blank page" anxiety.
2. **PKM / second brain** — Obsidian, Logseq, Reflect, Mem, Capacities, Tana.
   Backlinks, graph, daily notes, plugins, local-first. Powerful, lonely,
   fiddly to set up.
3. **Native quick-capture** — Apple Notes, Google Keep, Samsung Notes,
   Outlook/OneNote. Frictionless, ubiquitous, weak structure.
4. **Calm/aesthetic** — Bear, iA Writer, Craft. Beautiful, focused, mostly
   text-only.
5. **Whiteboard/visual** — Excalidraw, tldraw, Heptabase, Scrintal.
   Spatial canvases, freeform, weak text editing.

**Notai sits at the intersection of 1+3+5**: a calm, visible, drawable,
collaborative notes app where capture is a single gesture and the workspace
fades away. The gap most products leave open: *being there when you don't
have a hand free to organize*. Stickies that pin themselves to your screen
are the wedge.

---

## 2. Per-competitor strengths and what we steal

For each: 3 things they do best, 1 thing we should explicitly *not* copy,
and what Notai already matches.

### Notion
**Best:** (1) Database/views (table, board, calendar, gallery, timeline) with
relations and rollups. (2) Connected workspaces — comments, mentions, share
to anyone. (3) Notion AI: chat with workspace + meeting notes + Connectors
(GitHub, Slack, GDrive, Linear).
**Don't copy:** Permission sprawl and "page is loading" latency.
**Notai parity:** ✅ slash menu, ✅ TipTap blocks, ✅ realtime, ✅ public
links, ✅ MCP API, ❌ databases/views, ❌ comments, ❌ Connectors-style
external search.

### OneNote
**Best:** (1) Free-form 2D canvas with a real text + ink layer per page —
nothing else feels this much like a paper notebook. (2) Tight Outlook /
Microsoft 365 / Teams integration; "send to OneNote" is one click anywhere
in the OS. (3) Sections + section groups + notebooks — three-pane spatial
hierarchy that's instantly skimmable.
**Don't copy:** Sync conflicts; the mobile/desktop drift.
**Notai parity:** ✅ canvas + text together (canvas-note), ❌ Outlook/email
"send to Notai", ⚠️ hierarchy is folders only (no notebooks/sections).

### Obsidian
**Best:** (1) Local-first markdown vault — your notes survive the company.
(2) Plugin ecosystem (Bases, Dataview, Excalidraw, Templater, Canvas).
(3) Backlinks + graph + daily notes done with no compromises.
**Don't copy:** Setup tax — most users never finish configuring it.
**Notai parity:** ✅ backlinks, ✅ daily notes, ❌ graph view, ❌ plugins,
❌ markdown-on-disk export/sync, ❌ vault as folder.

### Apple Notes
**Best:** (1) Capture latency: lock-screen → thought captured in <1s.
(2) System-deep stylus on iPad — Apple Pencil is the gold standard.
(3) Quick Notes overlay (corner-swipe) and shared notes via iCloud.
**Don't copy:** Walled garden; no web; weak search; no real plugins.
**Notai parity:** ⚠️ PWA quick-capture exists but isn't <1s on cold start,
✅ S Pen via PointerEvent, ❌ corner-swipe / always-available overlay.

### Google Keep
**Best:** (1) Pinned color-coded cards on a 2-column board — visual triage
at a glance. (2) Voice memo with auto-transcript on Android. (3) Reminders
tied to time *and* place (geofence).
**Don't copy:** No structure beyond labels; ages 15+ notes unusable.
**Notai parity:** ✅ pinned, ✅ colored stickies, ✅ voice → transcript,
❌ board view, ❌ location reminders.

### Outlook (Notes / "Loop" / Sticky Notes)
**Best:** (1) Windows Sticky Notes desktop app: 5-second capture, syncs to
phone. (2) "Loop components" — paste a live block into Teams/Outlook that
stays editable. (3) Email-to-note via "send to OneNote"/Loop.
**Don't copy:** Three competing notes products with overlapping UX.
**Notai parity:** ✅ desktop stickies (Tauri), ❌ embeddable Loop-like
components, ❌ email-to-note.

### Evernote
**Best:** (1) Web Clipper — still the industry standard 15 years on; full
DOM, simplified article, screenshot, region all in one popup. (2) OCR over
images and PDFs, searchable everywhere. (3) Document scanner with
auto-cropping on mobile.
**Don't copy:** Pricing pain; bloat; nag screens.
**Notai parity:** ✅ web clipper extension exists, ⚠️ clipper is text-only
(no DOM/screenshot/region), ❌ OCR, ❌ document scanner.

### Bear
**Best:** (1) Tag-as-folder model — `#work/clients/acme` *is* a hierarchy.
(2) Beautiful typography with ~14 themes; reading vs. editing modes.
(3) Markdown-native with live preview that doesn't break flow.
**Don't copy:** macOS-only origin; weak collaboration.
**Notai parity:** ⚠️ tags exist but no hierarchical tag-as-folder, ❌ theme
gallery, ❌ markdown live preview mode.

### Mem
**Best:** (1) Auto-organization: AI assigns tags, related notes, and
"smart collections" without folders. (2) Mem Chat: chat with your entire
note history. (3) Quick-capture bar that's always present.
**Don't copy:** Inscrutable AI moves your notes around without consent.
**Notai parity:** ❌ AI auto-tag, ⚠️ Ask is one-shot (not chat),
✅ quick-capture exists but isn't ambient.

### Reflect
**Best:** (1) End-to-end encrypted by default. (2) Backlinked daily-note
loop; calendar in the sidebar. (3) GPT-4 powered "Ask AI" + outline tool +
voice transcript.
**Don't copy:** Pricing locks essentials.
**Notai parity:** ❌ E2E encryption, ⚠️ daily notes exist but no calendar
sidebar, ✅ AI ask, ✅ voice.

### Logseq
**Best:** (1) Outliner-first — every block is addressable, draggable,
embeddable. (2) Local-first markdown with bidirectional links and queries.
(3) Whiteboard mode for spatial thinking.
**Don't copy:** Outliner-only is a hard turn for new users.
**Notai parity:** ❌ outliner mode, ❌ block embeds, ✅ canvas mode
(canvas-note).

### Craft
**Best:** (1) Best-in-class document aesthetics — covers, blocks, fonts,
animations. (2) Daily notes with calendar nav. (3) Native iPad/iOS apps
with Apple Pencil + Stage Manager.
**Don't copy:** Apple-first means web feels secondary.
**Notai parity:** ⚠️ basic icon picker only (no covers/banners), ❌ native
mobile, ❌ document-grade typography.

### Capacities
**Best:** (1) Object-typed notes — "this is a Person, this is a Book" —
with type-specific properties and views. (2) PARA/Zettelkasten templates
that actually work. (3) Calendar that auto-populates from any note with a
date property.
**Don't copy:** Steep type-system learning curve.
**Notai parity:** ❌ typed notes, ❌ properties/schema, ❌ auto-calendar.

### Tana
**Best:** (1) Supertags — schema-defined tag types with fields, queries,
templates. (2) Inline AI commands per node. (3) Live workspace queries
update everywhere.
**Don't copy:** Power-user only; hard onboarding.
**Notai parity:** ❌ everything Tana does (schema/queries/AI nodes).

### Anytype
**Best:** (1) Local-first + P2P sync, no servers required. (2) Object types
with relations (like Capacities + Notion combined). (3) Open-source,
self-hostable.
**Don't copy:** Custom binary format means hard exit.
**Notai parity:** ⚠️ self-hostable in theory (Docker + Postgres + GCS), but
no P2P; ❌ object types.

---

## 3. Gap matrix — what we have vs. what they have

Legend: ✅ done · ⚠️ partial · ❌ missing · — N/A
Comparison set chosen for breadth: Notion, OneNote, Obsidian, Apple Notes,
Keep, Evernote, Mem, Reflect, Tana.

| Capability | Notai | Notion | OneNote | Obsidian | Apple | Keep | Evernote | Mem | Reflect | Tana |
|---|---|---|---|---|---|---|---|---|---|---|
| **Editor** |
| Slash menu blocks | ✅ | ✅ | ⚠️ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Tables | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Toggles / collapsibles | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Callouts / admonitions | ❌ | ✅ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Math (KaTeX) | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Mermaid / diagrams | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Embeds (YouTube, Loom, Figma…) | ❌ | ✅ | ⚠️ | ✅ | ❌ | ❌ | ⚠️ | ✅ | ✅ | ✅ |
| Code with syntax highlight | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Drawing / handwriting | ✅ | ⚠️ | ✅ | ⚠️ plugin | ✅ | ❌ | ⚠️ | ❌ | ❌ | ❌ |
| Spatial canvas | ✅ | ❌ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Capture** |
| Web clipper | ⚠️ basic | ✅ | ✅ | ⚠️ plugin | ⚠️ Safari | ✅ | ✅ best | ✅ | ✅ | ⚠️ |
| Screenshot to note | ❌ | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ |
| Document scanner / OCR | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Voice → transcript | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Email-to-note | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Mobile share target | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Quick-capture overlay | ⚠️ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| **Organization** |
| Folders | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ⚠️ | ❌ |
| Tags | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hierarchical tags | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Pinning / favorites | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ |
| Backlinks | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Graph view | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ |
| Full-text search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Semantic search | ✅ | ✅ | ✅ | ⚠️ plugin | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Saved searches / smart folders | ❌ | ✅ | ❌ | ⚠️ plugin | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Databases / views | ❌ | ✅ | ❌ | ⚠️ Bases | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Properties / metadata schema | ⚠️ minimal | ✅ | ❌ | ⚠️ | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **Collab & sharing** |
| Realtime co-editing | ✅ | ✅ | ✅ | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ❌ | ✅ |
| Presence cursors | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Comments / threads | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| @-mentions of users | ❌ | ✅ | ✅ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Public read-only links | ✅ | ✅ | ✅ | ⚠️ Publish | ⚠️ | ❌ | ✅ | ⚠️ | ⚠️ | ✅ |
| Public editable / forms | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| Per-block permissions | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Multi-tenant workspaces | ❌ | ✅ | ✅ | ❌ | ⚠️ family | ❌ | ⚠️ | ❌ | ⚠️ | ✅ |
| **Sync, offline, devices** |
| Native desktop | ✅ Tauri | ✅ Electron | ✅ | ✅ | ✅ | ❌ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Always-on-top stickies | ✅ | ❌ | ⚠️ | ⚠️ plugin | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| System tray / menu bar | ✅ | ❌ | ❌ | ⚠️ plugin | ❌ | ❌ | ✅ | ⚠️ | ❌ | ❌ |
| Native iOS app | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Native Android app | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PWA installable | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ⚠️ | ⚠️ | ✅ | ✅ | ❌ |
| Offline edit + sync | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅ |
| E2E encryption | ❌ | ❌ | ❌ | ⚠️ E2EE Sync | ⚠️ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **AI** |
| Slash-AI in editor | ❌ | ✅ | ✅ Copilot | ⚠️ plugin | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |
| Chat-with-notes (multi-turn) | ⚠️ Ask | ✅ | ✅ Copilot | ⚠️ plugin | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| AI auto-tag / auto-link | ❌ | ⚠️ | ❌ | ⚠️ plugin | ❌ | ❌ | ❌ | ✅ | ⚠️ | ✅ |
| Summarize / rewrite / extract | ✅ | ✅ | ✅ | ⚠️ plugin | ⚠️ | ❌ | ⚠️ | ✅ | ✅ | ✅ |
| Connectors (GitHub/Slack/GDrive) | ❌ | ✅ AI Connectors | ⚠️ M365 | ❌ | ❌ | ❌ | ❌ | ✅ | ⚠️ | ❌ |
| Voice → transcript → note | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Meeting recorder / transcripts | ❌ | ✅ | ⚠️ | ❌ | ⚠️ | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| BYOK | ✅ | ❌ | ❌ | ⚠️ plugin | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| MCP / external API | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tasks, calendar, time** |
| Daily notes | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Today / rollover | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| Tasks with due dates | ❌ | ✅ | ⚠️ | ⚠️ plugin | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |
| Recurring tasks | ❌ | ✅ | ❌ | ⚠️ plugin | ⚠️ | ✅ | ⚠️ | ❌ | ❌ | ✅ |
| Calendar view | ❌ | ✅ | ✅ | ⚠️ plugin | ⚠️ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Reminders / time-based | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| Location reminders | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| External calendar sync | ❌ | ✅ | ✅ Outlook | ⚠️ plugin | ✅ | ❌ | ❌ | ⚠️ | ✅ | ⚠️ |
| **Import / export** |
| Markdown export | ✅ | ✅ | ⚠️ | ✅ native | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| PDF / HTML export | ✅ Pro | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ⚠️ |
| Import from Notion | ❌ | — | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Import from Evernote | ❌ | ✅ | ⚠️ | ✅ | ❌ | ❌ | — | ✅ | ✅ | ✅ |
| Import from Markdown bulk | ❌ | ⚠️ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Bulk import from Apple/Keep | ❌ | ⚠️ | ⚠️ | ⚠️ | — | — | ✅ | ⚠️ | ⚠️ | ⚠️ |
| **Personalization** |
| Themes / color schemes | ⚠️ | ✅ | ⚠️ | ✅ many | ❌ | ❌ | ⚠️ | ⚠️ | ✅ | ⚠️ |
| Fonts / typography | ❌ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | ⚠️ | ❌ | ✅ | ❌ |
| Cover images / banners | ❌ | ✅ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ⚠️ |
| Focus / Zen mode | ❌ | ⚠️ | ❌ | ✅ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ |
| Custom CSS / plugins | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 4. Notai's strategic moats

Things only Notai is positioned to do well. Defend these.

1. **Always-visible thinking** — desktop stickies as a first-class object,
   not an afterthought. Pin a TODO to the corner of every monitor;
   tray-icon → new thought in <1s. Apple Notes can't, Notion won't,
   Obsidian needs a plugin.
2. **ADHD-first calm** — no streaks, no notifications by default, no
   gamification. Soft motion, OKLCH paper palette, optional structure.
3. **Realtime + drawing in one block** — Excalidraw and TipTap share a
   Y.Doc and a viewport. OneNote has the canvas; nothing has the realtime;
   nothing has the AI.
4. **BYOK + Copilot OAuth + MCP** — your model, your tokens, your data;
   third-party agents talk to the workspace through a typed contract.
5. **Self-hostable** — Docker + Postgres + GCS works on a laptop. Notion
   and Mem can't say that.

---

## 5. Prioritized backlog

P0 = ship next (≤4 weeks of focused work each, high leverage on retention or
acquisition). P1 = ship in 6–12 weeks. P2 = nice to have / depends on
adoption signal. Effort is rough developer-weeks for one engineer.

### P0 — ship next

| # | Feature | Why | Effort | Ref competitors |
|---|---|---|---|---|
| P0-1 | **Tables block (TipTap `@tiptap/extension-table`)** | The single most-cited gap in any TipTap-based editor. Trivial to add; massively widens "can I move my notes here?" answer | 0.5 wk | Notion, Obsidian, OneNote |
| P0-2 | **Callouts + toggle blocks + math + mermaid** | All TipTap-native or one-import. Completes the "looks like Notion" expectation; math + mermaid are differentiators vs. Apple/Keep | 1 wk | Notion, Obsidian, Reflect |
| P0-3 | **Slash-AI in the editor** (`/ai write`, `/ai continue`, `/ai expand`) | We have the AI provider and BYOK. Inline AI is the #1 reason people pay for Notion AI. Reuse existing `ai-actions.ts` | 1 wk | Notion AI, Mem, Reflect, Tana |
| P0-4 | **Chat-with-notes sidebar (multi-turn, citations)** | We have semantic search + Ask. Add session memory + sources panel. Locks in our "second brain" story | 1.5 wk | Mem, Reflect, Notion AI |
| P0-5 | **Real web clipper v2** (full DOM via Readability, region screenshot, simplified article, tags-on-clip) | Today's clipper is text-only. Evernote's clipper is the single biggest reason people *don't* leave Evernote | 1.5 wk | Evernote, Notion |
| P0-6 | **Comments + @-mentions on blocks** | Realtime infra is already there. Without comments we can't sell teams plan. Anchored to block id in Y.Doc | 1.5 wk | Notion, OneNote, Tana |
| P0-7 | **Quick-capture overlay (global hotkey on desktop, corner overlay on web)** | Sub-second capture is our moat. Apple Notes' Quick Note is the bar. Tauri global shortcut + always-on-top ephemeral window | 1 wk | Apple Notes, Keep, Sticky Notes |
| P0-8 | **Email-to-note inbound address** | `you+abcd@in.notai.app` → new note with attachments. Massive "send-receive habit loop". Postmark/SES inbound | 1 wk | Evernote, Notion, OneNote, Outlook |

**Total P0: ~9 dev-weeks.**

### P1 — 6 to 12 weeks out

| # | Feature | Why | Effort |
|---|---|---|---|
| P1-1 | **Tasks: due dates, recurring, today-rollup** | Daily notes already exist; promote checkbox blocks to first-class tasks with `dueAt`, `recurrenceRule`, owner. Power "Today" view | 2 wk |
| P1-2 | **Calendar view + Google/Outlook calendar import (read-only first)** | Pulls events into the daily note as suggested context. iCal subscribe is one weekend | 2 wk |
| P1-3 | **Properties / lightweight databases** (note properties + table view + filters) | Don't out-Notion Notion. Ship Bear-style flat properties + one filterable table view per folder | 3 wk |
| P1-4 | **Hierarchical tags (`#work/clients/acme`)** | One schema migration + parser change. Scales well past folder fatigue | 0.5 wk |
| P1-5 | **Graph view (force-directed, filtered by tag/folder)** | Backlinks are stored already. d3-force or @nivo/network. Visual proof of our PKM story | 1 wk |
| P1-6 | **OCR on uploads (image + PDF) → indexed in plaintext + embedding** | Tesseract.js client-side + server fallback to Vision API. Closes the Evernote/Apple-Notes gap | 1.5 wk |
| P1-7 | **Mobile native shells** (Tauri Mobile or Capacitor wrap of the PWA) | PWA already covers 80%. Native shell unlocks share-target, biometric, background sync, App Store presence | 3 wk |
| P1-8 | **Notion + Evernote + Markdown bulk import** | Block migration off the incumbents. ENEX parser + Notion zip parser + walk-the-folder MD | 2 wk |
| P1-9 | **Focus mode / Zen mode + Pomodoro overlay** | Already on adhd-ux-notes roadmap. `F` toggles a clean editor; pomodoro is a 25/5 timer + ambient sound (optional) | 1 wk |
| P1-10 | **Saved searches / smart folders** | Reuse search filters; save to sidebar. Kills "I lost that note again" | 0.5 wk |
| P1-11 | **Cover images + page banners + 3 typography presets** | Closes the Craft/Notion aesthetic gap with minimal code. Unsplash picker + 3 fonts | 1 wk |

**Total P1: ~17.5 dev-weeks.**

### P2 — depends on traction signal

- AI auto-tag + auto-link suggestions ("People also linked to…")
- Loop-style embeddable live blocks for Slack/Discord/Teams
- Public editable links / form mode (capture replies into a note)
- Per-block permissions
- Plugin/extension API (Obsidian-style, sandbox via iframe + permission grants)
- E2E encryption (per-note key wrapped to user keys; see Reflect's design)
- Document scanner on mobile (perspective-correct + OCR)
- Meeting recorder + speaker-diarized transcript (Deepgram or self-hosted)
- Object types / supertags / queries (compete directly with Tana/Capacities)
- Location-based reminders (geofence via Tauri Mobile)
- Connectors v1: GitHub issues + Linear tickets + GDrive search through MCP
- Multi-workspace / teams with per-workspace billing
- Desktop full-screen "wall mode" — turn an idle monitor into your sticky board

---

## 6. The wedge: 5 features that, together, beat each incumbent

If we ship exactly this list, our positioning is unique:

1. **Stickies that follow you across screens and devices** (P0-7) — beats
   Apple Notes, Keep, Sticky Notes on visibility.
2. **Drawing + text in one realtime canvas with AI** (already done, polish) —
   beats Notion, Obsidian, Apple Notes on creative range.
3. **Slash-AI + chat-with-notes + BYOK** (P0-3, P0-4) — beats Notion AI
   on flexibility and cost; beats Mem on transparency.
4. **One-keystroke capture from anywhere** (P0-5 clipper, P0-7 hotkey,
   P0-8 email-in, voice) — beats Evernote on the only axis Evernote still
   wins.
5. **Calm by default** (no notifications, OKLCH paper palette, focus mode,
   no streaks) — beats every productivity-coded competitor on emotional fit.

That's the pitch: *"Notai is what Notion would be if it cared about your
nervous system."*

---

## 7. How we keep this honest

- This doc is reviewed at the start of every quarterly cycle.
- Every shipped P0/P1 item moves to `CHANGELOG.md` and is checked off here.
- New competitor capability that lands on Hacker News / Product Hunt and
  > 3 users ask about → add a row to the gap matrix and decide P0/P1/P2
  within one sprint.
- We do not chase parity for parity's sake. If a feature doesn't serve the
  ADHD/calm/visible-thinking thesis, it stays at P2.

---

## 8. 2026 update — what shipped while we were heads-down

Refreshed 2026-05-09 from product launches and reviews across Sept 2025 → May 2026.

### The big shifts

- **Notion 3.0 "Agents" (Sep 18 2025)** — agents that can run for ~20 min, perform research, build databases, draft docs. Custom agents with their own instructions, knowledge, schedules. Multi-step actions inside your workspace. *Reaction:* parity isn't urgent for our wedge (we are calmer/lighter, not more agentic), but a single-task "Notai Assistant" that can fill a daily note, reorganize a corkboard, or run a scheduled "morning brief" is now table-stakes for power users. **P1.**
- **Notion AI Meeting Notes + Cmd-K Meeting Notes (2025)** — captures audio, transcribes, summarizes, writes follow-ups; Cmd-K creates structured meeting templates. *Reaction:* we now ship **Meeting Mode** (Granola-style, this release). Differentiator: ours is calm and inserts straight into your free-form canvas instead of a Notion database row.
- **Notion Skills + Charts dashboards (Mar 2026)** — saved "skills" you can re-invoke from Cmd-K; native charts on top of databases. *Reaction:* skills map cleanly onto our existing slash menu + AI prompts library; charts wait until we have first-class databases (P3).
- **Apple Math Notes (iPad/Mac, 2024-25; matured 2026)** — type any expression with `=`, get an inline live result; supports variable assignments and graphing. *Reaction:* shipped **Excalidraw-native Calc** in this release. We're the first non-Apple notes app with Math Notes parity that also works in a browser.
- **Apple Image Wand + Math Notes graphing** — sketch → image; equation → graph. *Reaction:* P2; needs a sketch-recognition model and is a polish moment, not a wedge feature.
- **Granola / Supernormal / Screenpipe (ambient meeting capture)** — mic + tab audio, transcribe in the background, AI-merge with your typed bullet points. Granola's killer move is "you keep typing your real notes, we polish them after the call". *Reaction:* shipped **Meeting Mode** with the same UX — raw notes on the right, transcript chunks streaming, one-click "enhance & insert".
- **Microsoft Copilot Notebooks + Loop (Sep 2025)** — Copilot can build a mind map from a notebook, then expand any node interactively; Loop pages embed live data. *Reaction:* mind-map-from-note maps onto our Excalidraw canvas perfectly — once block-migration is done we can offer "AI: organize this canvas as a mind map" as a one-click button. **P1, post-Phase-2.**
- **Tana Smart Builder + Voice notes (2025-26)** — voice-first capture that auto-classifies into projects, tasks, ideas. *Reaction:* our Quick Capture + voice transcription already gets us 70% there; auto-classify into existing notes/corkboards is **P1**.
- **Mem 2.0 / Reflect "AI search"** — unified semantic search across all notes with chat. *Reaction:* we have per-note chat; cross-workspace "Ask all my notes" is **P0** for the next sprint, gates retention.
- **Obsidian 1.7 Bases** — lightweight databases over folders of notes, no plugin needed. *Reaction:* fits PKM crowd, not our wedge. **P3.**
- **Heptabase Tags + AI summary cards (2026)** — visual canvas + AI cards. They're the closest visual-thinking competitor. *Reaction:* makes our Excalidraw bet correct; differentiator is collaborative real-time + ambient stickies.

### What this changes for our roadmap

1. **Excalidraw is the canvas — committed.** This release lays the foundation (no auto-seeded TipTap blocks, per-note migration). Phase 2 reimplements headings/lists/math/mermaid/callouts as Excalidraw-native and removes TipTap from notes.
2. **Meeting Mode shipped.** Validates the "calm capture, AI polish" pattern. Next: auto-summary triggers (no button), speaker diarization once Whisper-large supports it cheaply.
3. **Cross-note "Ask everything"** moves to P0. The semantic-search infra is already there for per-note chat; we extend it to corpus-wide.
4. **Single-task Assistant** moves to P1. Not multi-agent; one well-scoped morning-brief / weekly-review / inbox-sweep agent that respects the calm aesthetic.
5. **Mind-map-from-note** queued behind Phase 2 of the Excalidraw migration. The canvas already supports it; we just need the AI prompt + layout heuristic.

