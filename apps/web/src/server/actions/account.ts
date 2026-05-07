'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth, signOut } from '@/auth';
import { db, users, notes, eq } from '@notai/db';

/** Throws a user-visible error if the caller isn't signed in. */
async function requireUser() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Not signed in');
    return session.user as { id: string; email?: string | null; name?: string | null };
}

const profileSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Name cannot be empty')
        .max(80, 'Name is too long'),
});

/**
 * Update the signed-in user's display name. Returns the new value so the UI
 * can reflect it optimistically.
 */
export async function updateProfile(input: z.input<typeof profileSchema>) {
    const user = await requireUser();
    const { name } = profileSchema.parse(input);

    await db.update(users).set({ name }).where(eq(users.id, user.id));

    // Layouts pull `session.user` from `auth()`; revalidate any cached
    // segment that shows the name.
    revalidatePath('/app', 'layout');
    return { name };
}

/**
 * Export every note belonging to the signed-in user as a JSON-serializable
 * object. The Settings UI turns this into a `.json` download client-side.
 */
export async function exportUserNotes() {
    const user = await requireUser();
    const rows = await db.select().from(notes).where(eq(notes.ownerId, user.id));
    return {
        exportedAt: new Date().toISOString(),
        user: { id: user.id, email: user.email ?? null, name: user.name ?? null },
        notes: rows,
    };
}

const deleteSchema = z.object({
    confirmEmail: z.string().email(),
});

/**
 * Permanently delete the signed-in user's account. All notes, tags,
 * collaborators and sessions cascade-delete via foreign-key constraints.
 * Requires the user to retype their own email as confirmation.
 */
export async function deleteAccount(input: z.input<typeof deleteSchema>) {
    const user = await requireUser();
    const { confirmEmail } = deleteSchema.parse(input);

    if (!user.email || confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
        throw new Error('Email confirmation does not match');
    }

    await db.delete(users).where(eq(users.id, user.id));
    await signOut({ redirectTo: '/' });
}
