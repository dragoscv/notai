'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, userViews, eq, and, desc } from '@notai/db';
import { revalidatePath } from 'next/cache';

/**
 * Saved searches piggyback on the existing `user_views` table with
 * `scope = 'search'`. Filter payload mirrors what the command palette
 * actually toggles, so re-applying a saved search restores the exact
 * UI state.
 */

const SCOPE = 'search';
const MAX_PER_USER = 30;

const filtersSchema = z.object({
  query: z.string().min(1).max(200),
  semanticOn: z.boolean().default(false),
  pinnedOnly: z.boolean().default(false),
  favoritesOnly: z.boolean().default(false),
  stickiesOnly: z.boolean().default(false),
});

export type SavedSearchFilters = z.infer<typeof filtersSchema>;

export interface SavedSearch {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  position: number;
  createdAt: Date;
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  const rows = await db
    .select()
    .from(userViews)
    .where(and(eq(userViews.userId, userId), eq(userViews.scope, SCOPE)))
    .orderBy(desc(userViews.createdAt))
    .limit(MAX_PER_USER);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    createdAt: r.createdAt,
    filters: filtersSchema.parse(r.filters ?? {}),
  }));
}

const saveSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: filtersSchema,
});

export async function saveSavedSearch(input: z.input<typeof saveSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  const { name, filters } = saveSchema.parse(input);

  // Upsert by (user, scope, name) — the table has a unique index on
  // that triple, so we treat name as the natural key.
  await db
    .insert(userViews)
    .values({
      userId,
      scope: SCOPE,
      name,
      sort: 'updated',
      filters: filters as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: [userViews.userId, userViews.scope, userViews.name],
      set: { filters: filters as Record<string, unknown>, updatedAt: new Date() },
    });
  revalidatePath('/app');
}

export async function deleteSavedSearch(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await db
    .delete(userViews)
    .where(
      and(eq(userViews.id, id), eq(userViews.userId, session.user.id), eq(userViews.scope, SCOPE)),
    );
  revalidatePath('/app');
}
