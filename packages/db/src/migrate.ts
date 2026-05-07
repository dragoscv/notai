import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const host = new URL(url).hostname;
const isLocal = host === 'localhost' || host.startsWith('127.') || host === '::1';

const sql = postgres(url, {
    max: 1,
    ssl: isLocal ? false : { rejectUnauthorized: false },
});
const db = drizzle(sql);

await migrate(db, { migrationsFolder: './drizzle' });
await sql.end();
console.log('✓ migrations applied');
