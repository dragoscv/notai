#!/usr/bin/env node
/**
 * notai backup-restore drill.
 *
 * Proves a `.dump` file produced by `db-backup-nightly.yml` is actually
 * restorable end-to-end by:
 *   1. Creating a fresh throwaway database next to a target Postgres.
 *   2. Running `pg_restore --clean --create` into it.
 *   3. Verifying the restored DB has the expected shape:
 *        - >= MIN_TABLES tables in `public`
 *        - drizzle.__drizzle_migrations populated
 *        - users / notes tables exist (presence check, not count)
 *   4. Dropping the throwaway DB.
 *
 * Failures throw with an actionable message and exit non-zero so CI
 * (or the operator) treats them as a real incident.
 *
 * Usage:
 *   node scripts/backup-restore-drill.mjs --file=./notai-<ts>.dump
 *   # uses DRILL_DATABASE_URL or .env.local DATABASE_URL as the host.
 *
 *   node scripts/backup-restore-drill.mjs --file=./latest.dump --keep
 *   # leaves the throwaway DB in place for inspection.
 *
 * Exit codes:
 *   0  drill passed
 *   1  drill failed (any verification or restore error)
 */
import { existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    if (!a.startsWith('--')) return [];
    const [k, v] = a.slice(2).split('=');
    return [[k, v ?? true]];
  }),
);

if (!argv.file) die('Missing --file=<path-to-.dump>');
const dumpPath = resolve(repoRoot, String(argv.file));
if (!existsSync(dumpPath)) die(`Dump file not found: ${dumpPath}`);
const sizeMb = (statSync(dumpPath).size / 1024 / 1024).toFixed(2);

const MIN_TABLES = Number(process.env.DRILL_MIN_TABLES ?? 30);

const baseUrl = readBaseUrl();
const drillDbName = `notai_drill_${Date.now()}`;
const drillUrl = swapDatabase(baseUrl, drillDbName);

console.log(`▶ backup-restore drill`);
console.log(`  dump:        ${dumpPath} (${sizeMb} MB)`);
console.log(`  target host: ${redact(baseUrl)}`);
console.log(`  drill DB:    ${drillDbName}`);

ensureBinary('pg_restore');
ensureBinary('psql');

let createdDb = false;
try {
  exec('psql', [baseUrl, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${drillDbName}";`]);
  createdDb = true;

  console.log(`▶ restoring…`);
  exec('pg_restore', [
    '--dbname',
    drillUrl,
    '--no-owner',
    '--no-privileges',
    '--jobs',
    String(argv.jobs ?? 4),
    dumpPath,
  ]);

  console.log(`▶ verifying…`);
  const tableCount = Number(
    psqlScalar(drillUrl, `select count(*) from information_schema.tables where table_schema='public';`),
  );
  if (tableCount < MIN_TABLES) {
    die(`Only ${tableCount} tables in public schema (expected >= ${MIN_TABLES})`);
  }

  const migrations = Number(
    psqlScalar(
      drillUrl,
      `select count(*) from drizzle.__drizzle_migrations;`,
    ).trim(),
  );
  if (!Number.isFinite(migrations) || migrations < 1) {
    die(`drizzle.__drizzle_migrations is empty (got "${migrations}")`);
  }

  for (const t of ['users', 'notes', 'sessions', 'webhook_endpoints']) {
    const exists = psqlScalar(
      drillUrl,
      `select to_regclass('public.${t}') is not null;`,
    ).trim();
    if (exists !== 't') die(`Required table missing after restore: ${t}`);
  }

  console.log(`✓ drill PASSED`);
  console.log(`  tables:     ${tableCount}`);
  console.log(`  migrations: ${migrations}`);
} catch (err) {
  console.error(`✗ drill FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  if (createdDb && !argv.keep) {
    try {
      exec('psql', [baseUrl, '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE "${drillDbName}";`]);
      console.log(`▶ dropped ${drillDbName}`);
    } catch (err) {
      console.warn(`! could not drop ${drillDbName}: ${err}`);
    }
  } else if (argv.keep) {
    console.log(`▶ left ${drillDbName} in place for inspection (--keep)`);
  }
}

function readBaseUrl() {
  const env = process.env.DRILL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (env) return env;
  const local = resolve(repoRoot, '.env.local');
  if (existsSync(local)) {
    const m = readFileSync(local, 'utf8').match(/^DATABASE_URL=(.+)$/m);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  die(
    'No DRILL_DATABASE_URL / DATABASE_URL set. Provide a Postgres URL on a host where you can CREATE/DROP databases.',
  );
}

function swapDatabase(url, db) {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

function redact(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? '***@' : ''}${u.host}${u.pathname}`;
  } catch {
    return '<unparseable>';
  }
}

function ensureBinary(name) {
  const which = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(which, [name], { encoding: 'utf8' });
  if (r.status !== 0) die(`${name} not found on PATH. Install Postgres client tools.`);
}

function exec(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} exited with ${r.status}`);
}

function psqlScalar(url, sql) {
  const r = spawnSync('psql', [url, '-tA', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
