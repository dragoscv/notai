#!/usr/bin/env node
/**
 * notai · pending-migration drift check.
 *
 * Compares migrations on disk (`packages/db/drizzle/*.sql`) against the
 * `drizzle.__drizzle_migrations` table and exits non-zero if any are
 * pending. Used by the pre-push gate (against the dev's local
 * .env.production if it's pulled, otherwise .env.local) and by CI on
 * push-to-main (against PROD_DATABASE_URL secret).
 *
 * Usage:
 *   node scripts/check-migrations-pending.mjs --env=production
 *   node scripts/check-migrations-pending.mjs --env=local
 *   node scripts/check-migrations-pending.mjs --env=production --soft
 *
 * Flags:
 *   --soft   exit 0 with a warning if the env file is missing (so this
 *            can run in CI / on contributors who haven't pulled secrets)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import postgres from 'postgres';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    if (a.startsWith('--')) {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    }
    return [a, true];
  }),
);

const envName = args.env;
if (envName !== 'local' && envName !== 'production') {
  console.error('Missing or invalid --env=local|production');
  process.exit(2);
}
const soft = !!args.soft;

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const isProd = envName === 'production';
const envFile = join(repoRoot, isProd ? '.env.production' : '.env.local');
const migrationsDir = join(repoRoot, 'packages/db/drizzle');

// Allow CI to inject DATABASE_URL directly without an env file.
let databaseUrl = process.env.MIGRATION_CHECK_DATABASE_URL;
if (!databaseUrl) {
  if (!existsSync(envFile)) {
    if (soft) {
      console.log(`• ${envFile} not present — skipping migration drift check.`);
      process.exit(0);
    }
    console.error(`✖ ${envFile} not found.`);
    process.exit(1);
  }
  if (process.env.DATABASE_URL) delete process.env.DATABASE_URL;
  const envVars = parseDotenv(readFileSync(envFile, 'utf8'));
  databaseUrl = envVars.DATABASE_URL;
}

if (!databaseUrl) {
  if (soft) {
    console.log('• No DATABASE_URL available — skipping migration drift check.');
    process.exit(0);
  }
  console.error('✖ DATABASE_URL not set.');
  process.exit(1);
}

const target = parseDbUrl(databaseUrl);
const onDisk = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const onDiskHashes = new Map(
  onDisk.map((f) => {
    const sql = readFileSync(join(migrationsDir, f), 'utf8');
    return [f, createHash('sha256').update(sql).digest('hex')];
  }),
);

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  onnotice: () => {},
  ssl: target.host.includes('localhost') || target.host.startsWith('127.') ? false : 'prefer',
});

let appliedHashes = new Set();
try {
  const rows = await sql`select hash from drizzle.__drizzle_migrations`;
  appliedHashes = new Set(rows.map((r) => r.hash));
} catch (err) {
  await sql.end();
  if (soft) {
    console.log(`• Could not read migrations table (${err.message}) — skipping.`);
    process.exit(0);
  }
  console.error(`✖ Could not read drizzle.__drizzle_migrations: ${err.message}`);
  process.exit(1);
}
await sql.end();

const pending = [];
for (const [file, hash] of onDiskHashes) {
  if (!appliedHashes.has(hash)) pending.push(file);
}

if (pending.length === 0) {
  console.log(`✓ DB at ${target.host}/${target.database} has all ${onDisk.length} migration(s) applied.`);
  process.exit(0);
}

console.error('');
console.error(`✖ ${pending.length} migration(s) pending against ${target.host}/${target.database} (${envName}):`);
for (const f of pending) console.error(`    · ${f}`);
console.error('');
console.error('Run before deploying:');
console.error(`    node scripts/migrate.mjs --env=${envName}${isProd ? ' --backup' : ''}`);
console.error('');
process.exit(1);

// ──────────────────────────────────────────────────────────────────────
function parseDotenv(s) {
  const out = {};
  for (const raw of s.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}

function parseDbUrl(u) {
  const url = new URL(u);
  return {
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.replace(/^\//, ''),
    user: url.username,
  };
}
