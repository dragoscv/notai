# Onboarding & Empty-State Audit

Date: 2026-05-11

## Summary: solid, no blockers

Everything below is already shipped. Documented here so future audits don't re-flag.

| Surface | What new users see |
| --- | --- |
| First sign-in | `events.createUser` in `apps/web/src/auth.ts` calls `bootstrapUser()` (assigns role + free-tier sub) and `seedOnboardingNotes()` (creates 4 notes if zero exist) |
| Seeded notes | 👋 Welcome (pinned), 🟡 Capture, 🟣 Today, 🎨 Draw here — see `apps/web/src/server/onboarding.ts` |
| Onboarding tour | 5-step modal in `apps/web/src/components/layout/onboarding-tour.tsx`, mounted in `app/layout.tsx`; localStorage `notai:onboarding:completed-v1` prevents re-show |
| Keyboard shortcuts cheatsheet | `?` hotkey opens `apps/web/src/components/layout/shortcuts-cheatsheet.tsx`; 4 groups, 20+ shortcuts, platform-aware |
| Dashboard empty state | Sticky-note collage illustration + CTA (`apps/web/src/app/app/page.tsx`) |
| Folder empty state | Icon + "This folder is empty" + create button |
| Graph empty state | Two distinct messages: zero notes vs no links — actionable copy |
| Today page | Always populated (creates today's note on demand, redirects to it) |
| API keys empty state | Inline message inside `api-key-manager.tsx` |
| Webhooks empty state | Same pattern |

## Minor polish opportunities (deferred — non-blocking)

- **Sidebar tree** when zero notes/folders: currently shows nothing. Could add a one-line "✨ Press `n` to create your first note" hint. Low impact since the dashboard already prompts.
- **Inbox-zero page**: not verified in this audit. Worth a manual smoke test for the "Inbox: 0" cleared state.
- **Public templates discoverability**: `packages/db/src/seed-templates.ts` ships 10+ templates but no in-app tooltip pointing users to them. Could surface a "Try a template" tip on the second sign-in.

## Operator action items

- [ ] Smoke test: sign up with a fresh email; confirm 4 seeded notes appear and tour shows.
- [ ] Smoke test: dismiss tour, reload — should not reappear.
- [ ] Smoke test: delete all notes; confirm dashboard empty state shows the sticky-note illustration.

## Verdict

Onboarding is launch-ready. No code changes recommended for v1.
