'use server';

import { db, apiRequestLog, apiKeys, eq, and, sql, gte, count } from '@notai/db';
import { auth } from '@/auth';

export interface ApiKeyUsageStats {
  apiKeyId: string;
  totalLast30Days: number;
  errorsLast30Days: number;
  recent: Array<{
    path: string;
    method: string;
    status: number;
    durationMs: number;
    createdAt: Date;
  }>;
}

export async function getApiKeyUsage(apiKeyId: string): Promise<ApiKeyUsageStats | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [own] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.userId, session.user.id)))
    .limit(1);
  if (!own) return null;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [totals] = await db
    .select({
      total: count(),
      errors: sql<number>`count(*) filter (where ${apiRequestLog.status} >= 400)`.as('errors'),
    })
    .from(apiRequestLog)
    .where(and(eq(apiRequestLog.apiKeyId, apiKeyId), gte(apiRequestLog.createdAt, since)));
  const recent = await db
    .select({
      path: apiRequestLog.path,
      method: apiRequestLog.method,
      status: apiRequestLog.status,
      durationMs: apiRequestLog.durationMs,
      createdAt: apiRequestLog.createdAt,
    })
    .from(apiRequestLog)
    .where(eq(apiRequestLog.apiKeyId, apiKeyId))
    .orderBy(sql`${apiRequestLog.createdAt} DESC`)
    .limit(25);
  return {
    apiKeyId,
    totalLast30Days: Number(totals?.total ?? 0),
    errorsLast30Days: Number(totals?.errors ?? 0),
    recent,
  };
}
