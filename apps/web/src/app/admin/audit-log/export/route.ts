import { NextResponse } from 'next/server';
import { db, auditLog, users, eq, and, ilike, desc } from '@notai/db';
import { requirePermission } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ROWS = 10_000;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  await requirePermission('platform:audit_log');
  const url = new URL(req.url);
  const action = url.searchParams.get('action')?.trim();
  const resourceType = url.searchParams.get('resourceType')?.trim();
  const format = (url.searchParams.get('format') ?? 'csv').toLowerCase();

  const conditions = [];
  if (action) conditions.push(ilike(auditLog.action, `%${action}%`));
  if (resourceType) conditions.push(eq(auditLog.resourceType, resourceType));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      actorId: auditLog.actorId,
      actorEmail: users.email,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      before: auditLog.before,
      after: auditLog.after,
      metadata: auditLog.metadata,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId));

  const rows = await (where ? baseQuery.where(where) : baseQuery)
    .orderBy(desc(auditLog.createdAt))
    .limit(MAX_ROWS);

  if (format === 'json' || format === 'ndjson') {
    const body = rows.map((r) => JSON.stringify(r)).join('\n');
    return new NextResponse(body, {
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'content-disposition': `attachment; filename="audit-log-${Date.now()}.ndjson"`,
      },
    });
  }

  const header = [
    'id',
    'created_at',
    'actor_id',
    'actor_email',
    'action',
    'resource_type',
    'resource_id',
    'ip',
    'user_agent',
    'before',
    'after',
    'metadata',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt.toISOString(),
        r.actorId,
        r.actorEmail,
        r.action,
        r.resourceType,
        r.resourceId,
        r.ip,
        r.userAgent,
        r.before,
        r.after,
        r.metadata,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="audit-log-${Date.now()}.csv"`,
    },
  });
}
