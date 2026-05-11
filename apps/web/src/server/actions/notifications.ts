'use server';

import { z } from 'zod';
import { db, notifications, eq, and, desc, inArray, isNull } from '@notai/db';
import { auth } from '@/auth';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string };
}

export interface NotificationRow {
  id: string;
  kind: 'comment_mention' | 'comment_reply' | 'invite_received' | 'daily_digest';
  payload: {
    noteId?: string;
    noteTitle?: string;
    commentId?: string;
    fromUserId?: string;
    fromUserName?: string;
    snippet?: string;
    // daily_digest fields
    dateKey?: string;
    editedCount?: number;
    createdCount?: number;
  };
  readAt: string | null;
  createdAt: string;
}

const listSchema = z.object({
  unreadOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(50).default(20),
});

export async function listNotifications(
  input: z.input<typeof listSchema> = {},
): Promise<NotificationRow[]> {
  const me = await requireUser();
  const { unreadOnly, limit } = listSchema.parse(input);
  const where = unreadOnly
    ? and(eq(notifications.userId, me.id), isNull(notifications.readAt))
    : eq(notifications.userId, me.id);
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    payload: r.payload as NotificationRow['payload'],
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function unreadCount(): Promise<number> {
  const me = await requireUser();
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)))
    .limit(50);
  return rows.length;
}

const idsSchema = z.object({ ids: z.array(z.string().min(1)).max(50) });

export async function markRead(input: z.input<typeof idsSchema>) {
  const me = await requireUser();
  const { ids } = idsSchema.parse(input);
  if (ids.length === 0) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me.id), inArray(notifications.id, ids)));
}

export async function markAllRead() {
  const me = await requireUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
}
