'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { db, userKeys, eq } from '@notai/db';

/**
 * Server-side key vault for E2E encryption. The client generates the
 * master key, wraps it twice (under the passphrase-derived KEK and
 * under the recovery KEK), and ships the two ciphertexts here. We
 * NEVER receive the passphrase, recovery key, or master key in
 * plaintext — only the wrapped blobs.
 */

const setupSchema = z.object({
  salt: z.string().min(16).max(200),
  encryptedMasterKey: z.string().min(20).max(400),
  encryptedMasterKeyByRecovery: z.string().min(20).max(400),
  kdfIters: z.number().int().min(50_000).max(2_000_000).default(600_000),
});

export interface KeyEnvelope {
  salt: string;
  encryptedMasterKey: string;
  encryptedMasterKeyByRecovery: string;
  kdfIters: number;
}

export async function getMyKeyEnvelope(): Promise<KeyEnvelope | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [row] = await db
    .select()
    .from(userKeys)
    .where(eq(userKeys.userId, session.user.id))
    .limit(1);
  if (!row) return null;
  return {
    salt: row.salt,
    encryptedMasterKey: row.encryptedMasterKey,
    encryptedMasterKeyByRecovery: row.encryptedMasterKeyByRecovery,
    kdfIters: row.kdfIters,
  };
}

/**
 * First-time setup. Fails (instead of overwriting) if a key envelope
 * already exists — rotating to a new passphrase requires unwrapping
 * the old master key first via `rotatePassphrase`.
 */
export async function setupEncryption(
  input: z.input<typeof setupSchema>,
): Promise<{ ok: true } | { ok: false; reason: 'already_exists' }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const { salt, encryptedMasterKey, encryptedMasterKeyByRecovery, kdfIters } =
    setupSchema.parse(input);

  const existing = await db
    .select({ userId: userKeys.userId })
    .from(userKeys)
    .where(eq(userKeys.userId, session.user.id))
    .limit(1);
  if (existing.length > 0) return { ok: false, reason: 'already_exists' };

  await db.insert(userKeys).values({
    userId: session.user.id,
    salt,
    encryptedMasterKey,
    encryptedMasterKeyByRecovery,
    kdfIters,
  });
  return { ok: true };
}

const rotateSchema = setupSchema;

/**
 * Rotate the passphrase: client unwraps the old master key, derives
 * a new KEK from the new passphrase, re-wraps. The recovery key may
 * stay the same or be regenerated — both wrapped blobs are sent.
 */
export async function rotatePassphrase(input: z.input<typeof rotateSchema>): Promise<{ ok: true }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const { salt, encryptedMasterKey, encryptedMasterKeyByRecovery, kdfIters } =
    rotateSchema.parse(input);
  await db
    .update(userKeys)
    .set({
      salt,
      encryptedMasterKey,
      encryptedMasterKeyByRecovery,
      kdfIters,
      rotatedAt: new Date(),
    })
    .where(eq(userKeys.userId, session.user.id));
  return { ok: true };
}

export async function disableEncryption(): Promise<{ ok: true }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  await db.delete(userKeys).where(eq(userKeys.userId, session.user.id));
  return { ok: true };
}
