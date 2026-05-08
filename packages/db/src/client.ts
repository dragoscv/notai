import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';
import * as schema from './schema/index';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

/**
 * Creates a drizzle client. Auto-detects Neon vs plain Postgres based on the
 * URL host — so local dev (Docker) and prod (Neon) both work without code
 * changes.
 *
 * NOTE: We cache the postgres-js connection pool on `globalThis` so that
 * Next.js / Turbopack HMR module reloads don't keep creating fresh pools,
 * which quickly exhausts Postgres's `max_connections` in dev.
 */
// Both drivers share the same API surface for our use cases; we type as the
// postgres-js variant because its `.returning(selection)` overloads are the
// superset and a union here narrows return types to 0-arg in TS.
type DbInstance = ReturnType<typeof drizzlePg<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __notaiSql?: ReturnType<typeof postgres>;
  __notaiDb?: DbInstance;
};

function createDb(): DbInstance {
  const isNeon = /neon\.tech|neon\.build/.test(url!);
  if (isNeon) {
    const client = neon(url!);
    return drizzleNeon({ client, schema, casing: 'snake_case' }) as unknown as DbInstance;
  }
  // Cloud SQL Unix socket form `postgres://user:pass@/dbname?host=/cloudsql/...`
  // is rejected by Node's WHATWG URL parser (empty hostname). Detect it and
  // build a config object instead of letting postgres-js call `new URL()`.
  const cloudSqlMatch = url!.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@\/([^?]+)\?host=([^&]+)/);
  const sql =
    globalForDb.__notaiSql ??
    (cloudSqlMatch
      ? postgres({
          host: decodeURIComponent(cloudSqlMatch[4]!),
          database: decodeURIComponent(cloudSqlMatch[3]!),
          user: decodeURIComponent(cloudSqlMatch[1]!),
          password: decodeURIComponent(cloudSqlMatch[2]!),
          ssl: false,
          max: process.env.NODE_ENV === 'production' ? 10 : 5,
          idle_timeout: 20,
          max_lifetime: 60 * 30,
          prepare: false,
        })
      : postgres(url!, {
          max: process.env.NODE_ENV === 'production' ? 10 : 5,
          idle_timeout: 20,
          max_lifetime: 60 * 30,
          prepare: false,
        }));
  if (process.env.NODE_ENV !== 'production') globalForDb.__notaiSql = sql;
  return drizzlePg({ client: sql, schema, casing: 'snake_case' });
}

export const db: DbInstance = globalForDb.__notaiDb ?? createDb();
if (process.env.NODE_ENV !== 'production') globalForDb.__notaiDb = db;

export type Database = typeof db;
export { schema };
