import 'server-only';
import { db, eq, emailSuppressions, type EmailSuppression } from '@notai/db';

/** Lowercased lookup. Idempotent insert (PK = email). */
export async function isSuppressed(email: string): Promise<EmailSuppression | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const row = await db.query.emailSuppressions.findFirst({
    where: eq(emailSuppressions.email, e),
  });
  return row ?? null;
}

interface AddSuppressionInput {
  email: string;
  reason: 'bounce' | 'complaint' | 'manual' | 'delivery_delayed';
  source?: string;
  detail?: string;
  payload?: unknown;
}

export async function addSuppression(input: AddSuppressionInput): Promise<void> {
  const e = input.email.trim().toLowerCase();
  if (!e) return;
  // jsonb column expects an unknown value; cast through `as never` to satisfy
  // drizzle's $type<…>() inference without using `any`.
  const payload = (input.payload ?? null) as never;
  await db
    .insert(emailSuppressions)
    .values({
      email: e,
      reason: input.reason,
      source: input.source ?? null,
      detail: input.detail ?? null,
      payload,
    })
    .onConflictDoUpdate({
      target: emailSuppressions.email,
      set: {
        reason: input.reason,
        source: input.source ?? null,
        detail: input.detail ?? null,
        payload,
      },
    });
}

export async function removeSuppression(email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e) return;
  await db.delete(emailSuppressions).where(eq(emailSuppressions.email, e));
}
