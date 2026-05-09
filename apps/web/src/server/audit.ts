import 'server-only';
import { headers } from 'next/headers';
import { db, auditLog } from '@notai/db';
import { getViewer } from './rbac';

export interface AuditOptions {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Append an entry to the audit log. Reads the current viewer + request
 * headers automatically. Never throws — audit log failures must not break
 * the user-facing operation.
 */
export async function audit(opts: AuditOptions): Promise<void> {
  try {
    const viewer = await getViewer();
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
      userAgent = h.get('user-agent') ?? null;
    } catch {
      // Outside a request context (cron, seed) — leave nulls.
    }
    await db.insert(auditLog).values({
      actorId: viewer?.id ?? null,
      action: opts.action,
      resourceType: opts.resourceType,
      resourceId: opts.resourceId ?? null,
      before: (opts.before ?? null) as never,
      after: (opts.after ?? null) as never,
      metadata: (opts.metadata ?? null) as never,
      ip,
      userAgent,
    });
  } catch (err) {
    console.error('[audit] failed to record', opts.action, err);
  }
}
