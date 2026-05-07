import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or } from '@notai/db';
import { signRealtimeToken } from '@notai/lib/jwt';

const bodySchema = z.object({ noteId: z.string().min(1) });

/**
 * Issues a short-lived JWT for the Hocuspocus websocket.
 * The token encodes the user, the note, and their role.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
    const { noteId } = parsed.data;

    // Verify access
    const [row] = await db
        .select({
            ownerId: notes.ownerId,
            collabRole: noteCollaborators.role,
        })
        .from(notes)
        .leftJoin(
            noteCollaborators,
            and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, session.user.id)),
        )
        .where(
            and(
                eq(notes.id, noteId),
                or(eq(notes.ownerId, session.user.id), eq(noteCollaborators.userId, session.user.id)),
            ),
        )
        .limit(1);

    if (!row) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const role = row.ownerId === session.user.id ? 'owner' : row.collabRole ?? 'viewer';

    const secret = process.env.HOCUSPOCUS_JWT_SECRET;
    if (!secret) throw new Error('HOCUSPOCUS_JWT_SECRET is not set');

    const token = await signRealtimeToken(
        {
            sub: session.user.id,
            name: session.user.name ?? 'Anon',
            email: session.user.email ?? '',
            noteId,
            role,
        },
        secret,
        60 * 60, // 1h
    );

    return NextResponse.json({ token, role });
}
