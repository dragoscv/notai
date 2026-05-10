'use server';

import { db, apiRequestLog, sql } from '@notai/db';

export interface StatusSummary {
  /** Total v1 API requests in the last 24h. */
  total24h: number;
  /** Requests that returned 5xx in the last 24h. */
  errors24h: number;
  /** Requests that returned 429 in the last 24h. */
  throttled24h: number;
  /** Average response time over the last 24h (ms). */
  avgLatencyMs: number;
  /** p95 response time over the last 24h (ms). */
  p95LatencyMs: number;
  /** Per-route breakdown sorted by traffic (descending). */
  routes: Array<{
    path: string;
    method: string;
    count: number;
    errorRate: number;
    avgMs: number;
  }>;
  /** 7-day daily totals + error counts for the chart. */
  daily: Array<{ day: string; total: number; errors: number }>;
}

/**
 * Public, opt-in API status page. Shows aggregate health of the
 * /api/v1/* surface so consumers can decide whether the platform is
 * meeting its informal targets. Reads only the `api_request_log`
 * table — no per-key data leaks.
 */
export async function getApiStatus(): Promise<StatusSummary> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [tot] = await db
    .select({
      total: sql<number>`count(*)`.as('total'),
      errors: sql<number>`count(*) filter (where ${apiRequestLog.status} >= 500)`.as('errors'),
      throttled: sql<number>`count(*) filter (where ${apiRequestLog.status} = 429)`.as('throttled'),
      avgMs: sql<number>`coalesce(avg(${apiRequestLog.durationMs}), 0)`.as('avg_ms'),
      p95Ms:
        sql<number>`coalesce(percentile_disc(0.95) within group (order by ${apiRequestLog.durationMs}), 0)`.as(
          'p95_ms',
        ),
    })
    .from(apiRequestLog)
    .where(sql`${apiRequestLog.createdAt} >= ${since24h}`);

  const routes = await db
    .select({
      path: apiRequestLog.path,
      method: apiRequestLog.method,
      count: sql<number>`count(*)`.as('count'),
      errors: sql<number>`count(*) filter (where ${apiRequestLog.status} >= 400)`.as('errors'),
      avgMs: sql<number>`coalesce(avg(${apiRequestLog.durationMs}), 0)`.as('avg_ms'),
    })
    .from(apiRequestLog)
    .where(sql`${apiRequestLog.createdAt} >= ${since24h}`)
    .groupBy(apiRequestLog.path, apiRequestLog.method)
    .orderBy(sql`count(*) desc`)
    .limit(20);

  const daily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${apiRequestLog.createdAt}), 'YYYY-MM-DD')`.as(
        'day',
      ),
      total: sql<number>`count(*)`.as('total'),
      errors: sql<number>`count(*) filter (where ${apiRequestLog.status} >= 500)`.as('errors'),
    })
    .from(apiRequestLog)
    .where(sql`${apiRequestLog.createdAt} >= now() - interval '7 days'`)
    .groupBy(sql`date_trunc('day', ${apiRequestLog.createdAt})`)
    .orderBy(sql`date_trunc('day', ${apiRequestLog.createdAt}) asc`);

  return {
    total24h: Number(tot?.total ?? 0),
    errors24h: Number(tot?.errors ?? 0),
    throttled24h: Number(tot?.throttled ?? 0),
    avgLatencyMs: Math.round(Number(tot?.avgMs ?? 0)),
    p95LatencyMs: Math.round(Number(tot?.p95Ms ?? 0)),
    routes: routes.map((r) => {
      const count = Number(r.count);
      const errors = Number(r.errors);
      return {
        path: r.path,
        method: r.method,
        count,
        errorRate: count > 0 ? errors / count : 0,
        avgMs: Math.round(Number(r.avgMs)),
      };
    }),
    daily: daily.map((d) => ({
      day: d.day,
      total: Number(d.total),
      errors: Number(d.errors),
    })),
  };
}
