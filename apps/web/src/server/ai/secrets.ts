import 'server-only';
import { db, userSecrets, userAiPrefs, eq, and } from '@notai/db';
import { decryptSecret, encryptSecret } from './crypto';

export type AiProvider = 'openai' | 'copilot';
export type AiFeature = 'chat' | 'embed' | 'transcribe';

export interface StoredSecret {
  id: string;
  provider: AiProvider;
  meta: Record<string, unknown>;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/** Returns connected providers for a user (no plaintext). */
export async function listUserSecrets(userId: string): Promise<StoredSecret[]> {
  const rows = await db.select().from(userSecrets).where(eq(userSecrets.userId, userId));
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider as AiProvider,
    meta: r.meta as Record<string, unknown>,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
  }));
}

/** Decrypts and returns the raw secret. Best-effort touches lastUsedAt. */
export async function getDecryptedSecret(
  userId: string,
  provider: AiProvider,
): Promise<{ secret: string; meta: Record<string, unknown> } | null> {
  const [row] = await db
    .select()
    .from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.provider, provider)))
    .limit(1);
  if (!row) return null;
  try {
    const secret = decryptSecret(row.ciphertext);
    void db
      .update(userSecrets)
      .set({ lastUsedAt: new Date() })
      .where(eq(userSecrets.id, row.id))
      .catch(() => {});
    return { secret, meta: row.meta as Record<string, unknown> };
  } catch {
    return null;
  }
}

export async function upsertUserSecret(opts: {
  userId: string;
  provider: AiProvider;
  secret: string;
  meta?: Record<string, unknown>;
  label?: string;
}): Promise<void> {
  const ciphertext = encryptSecret(opts.secret);
  await db
    .insert(userSecrets)
    .values({
      userId: opts.userId,
      provider: opts.provider,
      ciphertext,
      meta: opts.meta ?? {},
      label: opts.label,
    })
    .onConflictDoUpdate({
      target: [userSecrets.userId, userSecrets.provider],
      set: {
        ciphertext,
        meta: opts.meta ?? {},
        label: opts.label,
      },
    });
}

/** Update only the meta JSON (e.g. cached short-lived session token). */
export async function updateSecretMeta(
  userId: string,
  provider: AiProvider,
  meta: Record<string, unknown>,
): Promise<void> {
  await db
    .update(userSecrets)
    .set({ meta })
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.provider, provider)));
}

export async function deleteUserSecret(userId: string, provider: AiProvider): Promise<void> {
  await db
    .delete(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.provider, provider)));
}

export interface AiPrefs {
  chat: { provider: AiProvider | null; model: string | null };
  embed: { provider: AiProvider | null; model: string | null };
  transcribe: { provider: AiProvider | null; model: string | null };
}

export async function getUserAiPrefs(userId: string): Promise<AiPrefs> {
  const [row] = await db.select().from(userAiPrefs).where(eq(userAiPrefs.userId, userId)).limit(1);
  return {
    chat: {
      provider: (row?.chatProvider as AiProvider | undefined) ?? null,
      model: row?.chatModel ?? null,
    },
    embed: {
      provider: (row?.embedProvider as AiProvider | undefined) ?? null,
      model: row?.embedModel ?? null,
    },
    transcribe: {
      provider: (row?.transcribeProvider as AiProvider | undefined) ?? null,
      model: row?.transcribeModel ?? null,
    },
  };
}

export async function setUserAiPref(
  userId: string,
  feature: AiFeature,
  provider: AiProvider | null,
  model: string | null,
): Promise<void> {
  const map = {
    chat: { providerCol: 'chatProvider', modelCol: 'chatModel' },
    embed: { providerCol: 'embedProvider', modelCol: 'embedModel' },
    transcribe: {
      providerCol: 'transcribeProvider',
      modelCol: 'transcribeModel',
    },
  } as const;
  const cols = map[feature];
  const setObj: Record<string, unknown> = {
    [cols.providerCol]: provider,
    [cols.modelCol]: model,
    updatedAt: new Date(),
  };
  await db
    .insert(userAiPrefs)
    .values({
      userId,
      [cols.providerCol]: provider,
      [cols.modelCol]: model,
    } as typeof userAiPrefs.$inferInsert)
    .onConflictDoUpdate({
      target: userAiPrefs.userId,
      set: setObj,
    });
}
