import { db } from './client';
import { users, notes } from './schema';

async function main() {
  console.log('🌱 seeding...');

  const [user] = await db
    .insert(users)
    .values({
      email: 'you@example.com',
      name: 'Dragos',
    })
    .onConflictDoNothing()
    .returning();

  if (user) {
    await db.insert(notes).values([
      {
        ownerId: user.id,
        title: '👋 Welcome to Notai',
        icon: '👋',
        plaintext:
          'This is your first note. Draw with your S Pen, make checklists, organize with tags.',
      },
      {
        ownerId: user.id,
        title: '📌 Today',
        icon: '📌',
        kind: 'sticky',
        isPinned: true,
        plaintext: '- [ ] What do I want to focus on today?',
      },
    ]);
  }

  console.log('✓ seeded');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
