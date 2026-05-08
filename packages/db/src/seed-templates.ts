/**
 * Seed the public template gallery. Idempotent: re-runs upsert by slug.
 *
 * Run with `pnpm --filter @notai/db seed:templates`.
 */
import { db } from './client';
import { templates } from './schema/templates';
import { sql } from 'drizzle-orm';

interface SeedTemplate {
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  body: { kind: 'note'; plaintext: string };
}

const SEED: SeedTemplate[] = [
  {
    slug: 'daily-plan',
    title: 'Daily Plan (ADHD-friendly)',
    description: 'Three big things, energy check-in, and a brain dump.',
    category: 'Planning',
    icon: '🗓️',
    body: {
      kind: 'note',
      plaintext: [
        '# Daily Plan — ' + new Date().toDateString(),
        '',
        '## Energy check-in',
        '- Mood:',
        '- Sleep:',
        '- Meds taken: [ ]',
        '',
        '## Top 3 today',
        '1. ',
        '2. ',
        '3. ',
        '',
        '## Brain dump',
        '- ',
        '',
        '## Done',
        '- ',
      ].join('\n'),
    },
  },
  {
    slug: 'weekly-review',
    title: 'Weekly Review',
    description: "What worked, what didn't, what next week needs.",
    category: 'Planning',
    icon: '🔄',
    body: {
      kind: 'note',
      plaintext: [
        '# Weekly Review',
        '',
        '## Wins 🎉',
        '- ',
        '',
        '## Stuck on',
        '- ',
        '',
        '## What I learned',
        '- ',
        '',
        "## Next week's focus",
        '- ',
      ].join('\n'),
    },
  },
  {
    slug: 'meeting-notes',
    title: 'Meeting Notes',
    description: 'Attendees, decisions, action items.',
    category: 'Work',
    icon: '🤝',
    body: {
      kind: 'note',
      plaintext: [
        '# Meeting — ',
        '',
        '**Date:** ',
        '**Attendees:** ',
        '',
        '## Agenda',
        '- ',
        '',
        '## Decisions',
        '- ',
        '',
        '## Action items',
        '- [ ] ',
      ].join('\n'),
    },
  },
  {
    slug: 'reading-log',
    title: 'Reading Log',
    description: 'Capture quotes and the one idea that stuck.',
    category: 'Personal',
    icon: '📚',
    body: {
      kind: 'note',
      plaintext: [
        '# ',
        '**Author:** ',
        '**Date:** ',
        '',
        '## The one idea',
        '> ',
        '',
        '## Highlights',
        '- ',
        '',
        '## Questions for me',
        '- ',
      ].join('\n'),
    },
  },
  {
    slug: 'project-brief',
    title: 'Project Brief',
    description: 'One-pager: problem, who, what, when.',
    category: 'Work',
    icon: '📋',
    body: {
      kind: 'note',
      plaintext: [
        '# Project: ',
        '',
        '## Problem',
        '',
        '## Audience',
        '',
        '## Outcome',
        '',
        '## Milestones',
        '- [ ] ',
        '',
        '## Risks',
        '- ',
      ].join('\n'),
    },
  },
  {
    slug: 'gratitude-3',
    title: '3 Things',
    description: 'A 60-second gratitude + dopamine note.',
    category: 'Personal',
    icon: '✨',
    body: {
      kind: 'note',
      plaintext: [
        '# 3 things — ' + new Date().toDateString(),
        '',
        '## Grateful for',
        '1. ',
        '2. ',
        '3. ',
        '',
        '## Something I noticed',
        '- ',
      ].join('\n'),
    },
  },
  {
    slug: 'idea-capture',
    title: 'Idea Capture',
    description: 'Brain → page in 30 seconds.',
    category: 'Personal',
    icon: '💡',
    body: {
      kind: 'note',
      plaintext: [
        '# Idea: ',
        '',
        '## What is it?',
        '',
        '## Why does it matter?',
        '',
        '## What would the smallest first step look like?',
        '- [ ] ',
      ].join('\n'),
    },
  },
];

async function main() {
  for (const t of SEED) {
    await db
      .insert(templates)
      .values({
        slug: t.slug,
        title: t.title,
        description: t.description,
        category: t.category,
        icon: t.icon,
        body: t.body,
        isOfficial: true,
        isPublished: true,
      })
      .onConflictDoUpdate({
        target: templates.slug,
        set: {
          title: t.title,
          description: t.description,
          category: t.category,
          icon: t.icon,
          body: t.body,
          isOfficial: true,
          isPublished: true,
        },
      });
  }
  // Print the count to confirm.
  const rows = await db.select({ count: sql<number>`COUNT(*)` }).from(templates);
  const count = rows[0]?.count ?? 0;
  console.log(`✓ Seeded ${SEED.length} templates (total in DB: ${count}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
