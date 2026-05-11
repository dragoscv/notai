import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { createHash, randomBytes } from 'node:crypto';
import { db, eq, users, userTotp } from '@notai/db';

const ISSUER = process.env.NEXT_PUBLIC_APP_NAME ?? 'Notai';

export interface EnrollmentDraft {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

/** Generate (or replace) a pending TOTP secret. Returns QR data URL for the authenticator app. */
export async function startTotpEnrollment(
  userId: string,
  accountLabel: string,
): Promise<EnrollmentDraft> {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(accountLabel, ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
  await db
    .insert(userTotp)
    .values({ userId, secret, enabled: false })
    .onConflictDoUpdate({
      target: userTotp.userId,
      set: { secret, enabled: false, enabledAt: null, recoveryCodesHashed: [] as never },
    });
  return { secret, otpauthUrl, qrDataUrl };
}

/** Verify the enrollment code. On success, mark enabled and return single-use recovery codes (plain). */
export async function finishTotpEnrollment(
  userId: string,
  code: string,
): Promise<{
  ok: boolean;
  recoveryCodes?: string[];
  error?: string;
}> {
  const row = await db.query.userTotp.findFirst({ where: eq(userTotp.userId, userId) });
  if (!row) return { ok: false, error: 'No enrollment in progress' };
  if (!authenticator.check(code.replace(/\s+/g, ''), row.secret)) {
    return { ok: false, error: 'Invalid code' };
  }
  const codes = generateRecoveryCodes(10);
  const hashed = codes.map((c) => `sha256:${sha256(c)}`);
  await db
    .update(userTotp)
    .set({
      enabled: true,
      enabledAt: new Date(),
      lastUsedAt: new Date(),
      lastStepUpAt: new Date(),
      recoveryCodesHashed: hashed as never,
    })
    .where(eq(userTotp.userId, userId));
  return { ok: true, recoveryCodes: codes };
}

/** Disable TOTP. Requires a valid current code or recovery code. */
export async function disableTotp(
  userId: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const v = await verifyTotp(userId, code);
  if (!v.ok) return { ok: false, error: 'Invalid code' };
  await db.delete(userTotp).where(eq(userTotp.userId, userId));
  return { ok: true };
}

/** Verify a TOTP code OR consume a recovery code. Updates lastUsedAt + lastStepUpAt on success. */
export async function verifyTotp(
  userId: string,
  codeRaw: string,
): Promise<{ ok: boolean; usedRecovery?: boolean }> {
  const code = codeRaw.replace(/\s+/g, '');
  const row = await db.query.userTotp.findFirst({ where: eq(userTotp.userId, userId) });
  if (!row || !row.enabled) return { ok: false };
  // Try TOTP first.
  if (/^\d{6}$/.test(code) && authenticator.check(code, row.secret)) {
    await db
      .update(userTotp)
      .set({ lastUsedAt: new Date(), lastStepUpAt: new Date() })
      .where(eq(userTotp.userId, userId));
    return { ok: true };
  }
  // Try recovery code (consume on match).
  const want = `sha256:${sha256(code)}`;
  const codes = (row.recoveryCodesHashed as string[]) ?? [];
  if (codes.includes(want)) {
    const remaining = codes.filter((c) => c !== want);
    await db
      .update(userTotp)
      .set({
        recoveryCodesHashed: remaining as never,
        lastUsedAt: new Date(),
        lastStepUpAt: new Date(),
      })
      .where(eq(userTotp.userId, userId));
    return { ok: true, usedRecovery: true };
  }
  return { ok: false };
}

/** Returns true if the user has TOTP enabled AND has stepped up within the window. */
export async function hasFreshStepUp(userId: string, windowSeconds: number): Promise<boolean> {
  const row = await db.query.userTotp.findFirst({ where: eq(userTotp.userId, userId) });
  if (!row || !row.enabled) return true; // no TOTP enrolled => not required
  if (!row.lastStepUpAt) return false;
  return Date.now() - row.lastStepUpAt.getTime() < windowSeconds * 1000;
}

export async function getTotpStatus(userId: string): Promise<{
  enrolled: boolean;
  enabledAt: string | null;
  remainingRecoveryCodes: number;
  lastUsedAt: string | null;
}> {
  const row = await db.query.userTotp.findFirst({ where: eq(userTotp.userId, userId) });
  if (!row || !row.enabled) {
    return { enrolled: false, enabledAt: null, remainingRecoveryCodes: 0, lastUsedAt: null };
  }
  return {
    enrolled: true,
    enabledAt: row.enabledAt?.toISOString() ?? null,
    remainingRecoveryCodes: ((row.recoveryCodesHashed as string[]) ?? []).length,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function generateRecoveryCodes(n: number): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    // 10 chars from alphabet without ambiguous glyphs (no 0/O, 1/I/L)
    const buf = randomBytes(10);
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let j = 0; j < 10; j++) {
      const byte = buf[j] ?? 0;
      code += alphabet.charAt(byte % alphabet.length);
    }
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  return codes;
}
// Re-export for callers that just need user lookup convenience.
export { users };
