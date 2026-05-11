'use server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { db, e2eAuditLog, eq, desc } from '@notai/db';

export type E2eAuditEvent =
  | 'setup'
  | 'rotate'
  | 'note_lock'
  | 'note_unlock'
  | 'note_disable'
  | 'recovery_unlock';

const recordSchema = z.object({
  event: z.enum(['setup', 'rotate', 'note_lock', 'note_unlock', 'note_disable', 'recovery_unlock']),
  noteId: z.string().min(1).optional(),
});

async function captureContext(): Promise<{ userAgent: string | null; ip: string | null }> {
  try {
    const h = await headers();
    const userAgent = h.get('user-agent');
    const fwd = h.get('x-forwarded-for');
    const ip = (fwd?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim() || null;
    return { userAgent, ip };
  } catch {
    return { userAgent: null, ip: null };
  }
}

/**
 * Append a row to the user's E2E audit log. Used by client + server
 * code at every lifecycle moment. Errors are swallowed — losing a
 * single audit row should never block the actual user action.
 */
export async function recordE2eAudit(input: z.input<typeof recordSchema>): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user?.id) return;
    const { event, noteId } = recordSchema.parse(input);
    const { userAgent, ip } = await captureContext();
    await db.insert(e2eAuditLog).values({
      userId: session.user.id,
      noteId: noteId ?? null,
      event,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
      ip,
    });
  } catch {
    // intentionally non-throwing
  }
}

export interface E2eAuditRow {
  id: string;
  event: E2eAuditEvent;
  noteId: string | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
}

export async function listMyE2eAudit(): Promise<E2eAuditRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const rows = await db
    .select()
    .from(e2eAuditLog)
    .where(eq(e2eAuditLog.userId, session.user.id))
    .orderBy(desc(e2eAuditLog.createdAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    event: r.event as E2eAuditEvent,
    noteId: r.noteId,
    userAgent: r.userAgent,
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
  }));
}
