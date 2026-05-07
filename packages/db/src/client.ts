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
type DbInstance =
  | ReturnType<typeof drizzlePg<typeof schema>>
  | ReturnType<typeof drizzleNeon<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __notaiSql?: ReturnType<typeof postgres>;
  __notaiDb?: DbInstance;
};

function createDb(): DbInstance {
  const isNeon = /neon\.tech|neon\.build/.test(url!);
  if (isNeon) {
    const client = neon(url!);
    return drizzleNeon({ client, schema, casing: 'snake_case' });
  }
  const sql =
    globalForDb.__notaiSql ??
    postgres(url!, {
      max: process.env.NODE_ENV === 'production' ? 10 : 5,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      prepare: false,
    });
  if (process.env.NODE_ENV !== 'production') globalForDb.__notaiSql = sql;
  return drizzlePg({ client: sql, schema, casing: 'snake_case' });
}

export const db: DbInstance = globalForDb.__notaiDb ?? createDb();
if (process.env.NODE_ENV !== 'production') globalForDb.__notaiDb = db;

export type Database = typeof db;
export { schema };
