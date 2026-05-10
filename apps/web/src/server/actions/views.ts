'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, userViews, eq, and, asc } from '@notai/db';
import { viewSpecSchema, type ViewSpec, DEFAULT_VIEW_SPEC } from '@/lib/view-spec';

const SCOPE = 'dashboard';
const MAX_VIEWS_PER_USER = 20;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  return session.user;
}

export interface SavedView {
  id: string;
  name: string;
  isDefault: boolean;
  spec: ViewSpec;
}

/**
 * Returns all dashboard views for the user, sorted by `position`. When the
 * user has none, returns a synthetic in-memory "Default" view so the page
 * always has something to render. The synthetic view materializes into the
 * DB on the first `saveView` call.
 */
export async function listDashboardViews(): Promise<SavedView[]> {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(userViews)
    .where(and(eq(userViews.userId, user.id), eq(userViews.scope, SCOPE)))
    .orderBy(asc(userViews.position));

  if (rows.length === 0) {
    return [
      {
        id: '__default__',
        name: 'Default',
        isDefault: true,
        spec: DEFAULT_VIEW_SPEC,
      },
    ];
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    isDefault: r.isDefault,
    spec: viewSpecSchema.parse({
      sort: r.sort,
      pinnedFirst: r.pinnedFirst,
      filters: r.filters ?? {},
    }),
  }));
}

const saveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(50),
  spec: viewSpecSchema,
  isDefault: z.boolean().optional(),
});

/**
 * Create or update a saved view. Pass `id` to update an existing view, or
 * omit it to create a new one. Caps at 20 views per user.
 */
export async function saveDashboardView(input: z.input<typeof saveSchema>) {
  const user = await requireUser();
  const data = saveSchema.parse(input);

  if (data.id && data.id !== '__default__') {
    await db
      .update(userViews)
      .set({
        name: data.name,
        sort: data.spec.sort,
        pinnedFirst: data.spec.pinnedFirst,
        filters: data.spec.filters,
        updatedAt: new Date(),
      })
      .where(and(eq(userViews.id, data.id), eq(userViews.userId, user.id)));
    revalidatePath('/app');
    return { id: data.id };
  }

  const existing = await db
    .select({ id: userViews.id, position: userViews.position })
    .from(userViews)
    .where(and(eq(userViews.userId, user.id), eq(userViews.scope, SCOPE)));
  if (existing.length >= MAX_VIEWS_PER_USER) {
    throw new Error(`You can save at most ${MAX_VIEWS_PER_USER} views.`);
  }
  const nextPos = existing.reduce((m, e) => Math.max(m, e.position), 0) + 1;
  // First-ever view is automatically the default.
  const isDefault = data.isDefault ?? existing.length === 0;

  if (isDefault) {
    await db
      .update(userViews)
      .set({ isDefault: false })
      .where(and(eq(userViews.userId, user.id), eq(userViews.scope, SCOPE)));
  }

  const [created] = await db
    .insert(userViews)
    .values({
      userId: user.id,
      scope: SCOPE,
      name: data.name,
      sort: data.spec.sort,
      pinnedFirst: data.spec.pinnedFirst,
      filters: data.spec.filters,
      isDefault,
      position: nextPos,
    })
    .returning({ id: userViews.id });
  revalidatePath('/app');
  return { id: created!.id };
}

export async function deleteDashboardView(id: string) {
  const user = await requireUser();
  if (id === '__default__') return;
  await db.delete(userViews).where(and(eq(userViews.id, id), eq(userViews.userId, user.id)));
  revalidatePath('/app');
}

export async function setDefaultDashboardView(id: string) {
  const user = await requireUser();
  if (id === '__default__') return;
  await db
    .update(userViews)
    .set({ isDefault: false })
    .where(and(eq(userViews.userId, user.id), eq(userViews.scope, SCOPE)));
  await db
    .update(userViews)
    .set({ isDefault: true })
    .where(and(eq(userViews.id, id), eq(userViews.userId, user.id)));
  revalidatePath('/app');
}

export async function renameDashboardView(input: { id: string; name: string }) {
  const user = await requireUser();
  if (input.id === '__default__') return;
  const name = input.name.trim().slice(0, 50);
  if (!name) throw new Error('Name is required');
  await db
    .update(userViews)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(userViews.id, input.id), eq(userViews.userId, user.id)));
  revalidatePath('/app');
}
