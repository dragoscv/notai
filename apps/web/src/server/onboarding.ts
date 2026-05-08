'use server';

import { db, notes, eq, and, isNull } from '@notai/db';

const SEEDS = [
  {
    icon: '👋',
    title: 'Welcome to Notai',
    plaintext:
      `Welcome to Notai — your fast, freeform notes app.\n\n` +
      `A few things to try:\n` +
      `1. Press Cmd/Ctrl + K to search and create.\n` +
      `2. Click "Draw" in the toolbar to switch to ink mode.\n` +
      `3. Type [[ to link to another note.\n` +
      `4. Drop a PDF onto the canvas to annotate it.\n\n` +
      `Stickies, drawings, text — they all live in the same note. Mix freely.`,
    color: 'default',
    kind: 'note' as const,
  },
  {
    icon: '🟡',
    title: 'Capture',
    plaintext:
      `This sticky is here to grab fleeting thoughts.\n\n` +
      `Pop it out as its own window from the toolbar. ` +
      `It stays on top so you can keep typing while you do other work.`,
    color: 'sticky-yellow',
    kind: 'sticky' as const,
  },
  {
    icon: '🟣',
    title: 'Today',
    plaintext:
      `Use this sticky as your daily list.\n\n` +
      `[ ] One thing that matters today\n` +
      `[ ] One small thing to feel a win\n` +
      `[ ] One thing you'd happily skip`,
    color: 'sticky-purple',
    kind: 'sticky' as const,
  },
  {
    icon: '🎨',
    title: 'Draw here',
    plaintext:
      `This canvas is yours to scribble on. ` +
      `Click "Draw" in the toolbar (or press the pen button) to switch to ink mode. ` +
      `Drawings live alongside text in the same note — no second tool to open.`,
    color: 'default',
    kind: 'note' as const,
  },
];

/**
 * Seeds a tiny welcome workspace for a new user. Idempotent: if the user
 * already has any non-deleted note we do nothing (so re-runs in dev or
 * across signin flows don't spam them with extra welcome notes).
 */
export async function seedOnboarding(userId: string): Promise<{ seeded: number }> {
  const existing = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), isNull(notes.deletedAt)))
    .limit(1);
  if (existing.length > 0) return { seeded: 0 };

  let pos = 1000;
  for (const seed of SEEDS) {
    await db.insert(notes).values({
      ownerId: userId,
      title: seed.title,
      icon: seed.icon,
      plaintext: seed.plaintext,
      color: seed.color,
      kind: seed.kind,
      position: pos,
      isPinned: seed.title === 'Welcome to Notai',
    });
    pos += 1000;
  }
  return { seeded: SEEDS.length };
}
