'use server';

import { auth } from '@/auth';
import { db, emailAliases, eq } from '@notai/db';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';

/**
 * Inbound email alias management. The token is a 16-byte random
 * URL-safe string — anyone who knows it can deliver mail into the
 * user's notes, so we treat it like a password (rotatable).
 */

function generateToken(): string {
  // 16 bytes → 22 chars URL-safe base64. Plenty of entropy, fits in a
  // single email local-part comfortably.
  return randomBytes(16)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const INBOUND_DOMAIN = process.env.EMAIL_INBOUND_DOMAIN ?? 'in.notai.app';

export interface EmailAliasInfo {
  address: string;
  token: string;
  domain: string;
  configured: boolean;
}

export async function getOrCreateEmailAlias(): Promise<EmailAliasInfo> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new Error('Sign in required');
  }
  const userId = session.user.id;

  const [existing] = await db
    .select({ token: emailAliases.token })
    .from(emailAliases)
    .where(eq(emailAliases.userId, userId))
    .limit(1);
  let token = existing?.token;
  if (!token) {
    token = generateToken();
    await db.insert(emailAliases).values({ userId, token }).onConflictDoNothing();
    // re-read to honour a concurrent insert
    const [row] = await db
      .select({ token: emailAliases.token })
      .from(emailAliases)
      .where(eq(emailAliases.userId, userId))
      .limit(1);
    token = row?.token ?? token;
  }

  const local =
    session.user.email
      .split('@')[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9._-]/g, '') || 'you';
  return {
    address: `${local}+${token}@${INBOUND_DOMAIN}`,
    token,
    domain: INBOUND_DOMAIN,
    configured: Boolean(process.env.EMAIL_INBOUND_DOMAIN),
  };
}

export async function rotateEmailAlias(): Promise<EmailAliasInfo> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sign in required');
  const userId = session.user.id;
  const next = generateToken();
  await db
    .update(emailAliases)
    .set({ token: next, rotatedAt: new Date() })
    .where(eq(emailAliases.userId, userId));
  revalidatePath('/app');
  return getOrCreateEmailAlias();
}
