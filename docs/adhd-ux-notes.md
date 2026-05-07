# ADHD-friendly patterns baked into Notai

Notes on the UX choices you'll actually feel:

## Fast capture
- `⌘N` from anywhere → new note opens immediately (no modal)
- `⌘K` → command palette: search + create + jump
- PWA app shortcuts: long-press the icon on your Galaxy homescreen → "New note" / "Today"
- Share target: share from any app → lands directly in Notai

## Always visible
- Sticky windows (Tauri) can be pinned always-on-top — your TODO never leaves your sight
- Tray icon → 1 click to create a new sticky
- Color coded stickies (6 pastel colors) so you can scan visually

## Low-friction
- Every note autosaves (no save button to forget)
- Works offline; you'll never lose a thought to bad wi-fi
- Title is optional (defaults to "Untitled"); just start typing
- Draw mode is one click away from text; no need to decide what kind of note up-front

## Focus mode (roadmap)
- `F` key in the editor → hide sidebar, hide toolbar, soft background
- Pomodoro overlay

## Daily "Today" view
- First thing you see on `/app` is today's date and your pinned notes
- Recent notes ordered by most-recently updated so you pick up where you left off

## What we deliberately left OUT
- No notifications by default (ADHD brains don't need more interruptions). Opt-in only.
- No "streaks" or gamification — shame is not motivation.
- No mandatory folders/hierarchies — use tags when you want, ignore them when you don't.
