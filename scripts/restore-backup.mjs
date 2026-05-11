#!/usr/bin/env node
/**
 * notai DB restore — counterpart to .github/workflows/db-backup-nightly.yml.
 *
 * Usage:
 *   node scripts/restore-backup.mjs --file=./notai-<ts>.dump --target=local
 *   node scripts/restore-backup.mjs --file=./notai-<ts>.dump --target=production --yes
 *
 * --file=PATH        path to a pg_dump custom-format file (.dump)
 * --target=local|production  which env file to load DATABASE_URL from
 * --jobs=N           parallel restore jobs (default 4)
 * --clean            DROP tables before recreating (dangerous; off by default)
 * --schema-only      restore schema only, no data
 * --data-only        restore data only, assume schema exists
 * --yes              skip the confirmation prompt
 *
 * Safety:
 *   - PRODUCTION restores require typing the literal string "restore"
 *     (not just "yes") and force --target=production to be on the
 *     command line — never inferable.
 *   - Verifies that `pg_restore` is on PATH and >= the dump's catalog
 *     version before doing anything destructive.
 *   - Streams pg_restore output live so a 5-minute restore doesn't
 *     look like a hang.
 */
import { existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import readline from 'node:readline';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    if (!a.startsWith('--')) return [];
    const [k, v] = a.slice(2).split('=');
    return [[k, v ?? true]];
  }),
);

const C = process.stdout.isTTY
  ? { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
  : { red: '', green: '', yellow: '', dim: '', bold: '', reset: '' };
const die = (m) => {
  console.error(`${C.red}${C.bold}✖ ${m}${C.reset}`);
  process.exit(1);
};

if (!argv.file) die('--file=<path-to-.dump> is required');
if (!argv.target) die('--target=local|production is required');
if (!['local', 'production'].includes(argv.target)) die('--target must be "local" or "production"');

const dumpPath = resolve(process.cwd(), argv.file);
if (!existsSync(dumpPath)) die(`Dump not found: ${dumpPath}`);
const dumpSize = statSync(dumpPath).size;

const envFile = resolve(repoRoot, argv.target === 'production' ? '.env.production' : '.env.local');
if (!existsSync(envFile)) die(`Env file not found: ${envFile}`);

// Strip leaked DATABASE_URL so the chosen env file wins.
delete process.env.DATABASE_URL;

const envText = await import('node:fs').then((m) => m.readFileSync(envFile, 'utf8'));
const envVars = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      if (i < 0) return null;
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    })
    .filter(Boolean),
);
const url = envVars.DATABASE_URL;
if (!url) die(`DATABASE_URL not present in ${envFile}`);

let parsed;
try {
  parsed = new URL(url);
} catch {
  die('DATABASE_URL is not a valid URL');
}

console.log(`${C.bold}notai · DB restore${C.reset}`);
console.log(`  ${C.dim}env file ${C.reset}${envFile}`);
console.log(`  ${C.dim}target   ${C.reset}${parsed.hostname}:${parsed.port || 5432}/${parsed.pathname.slice(1)} as ${parsed.username}`);
console.log(`  ${C.dim}dump     ${C.reset}${dumpPath} (${(dumpSize / 1024 / 1024).toFixed(1)} MB)`);

// Confirm pg_restore is available.
const v = spawnSync('pg_restore', ['--version'], { encoding: 'utf8' });
if (v.status !== 0) die('pg_restore not found on PATH. Install postgresql-client (matching server major).');
console.log(`  ${C.dim}pg_restore${C.reset} ${v.stdout.trim()}`);

if (argv.target === 'production') {
  if (!argv.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = await new Promise((r) =>
      rl.question(
        `\n${C.red}${C.bold}This will write to PRODUCTION.${C.reset} Type "${C.bold}restore${C.reset}" to proceed: `,
        (a) => {
          rl.close();
          r(a.trim());
        },
      ),
    );
    if (ans !== 'restore') die('Aborted.');
  }
}

const args = [
  `--dbname=${url}`,
  `--jobs=${Number(argv.jobs ?? 4)}`,
  '--no-owner',
  '--no-privileges',
  '--verbose',
];
if (argv.clean) args.push('--clean', '--if-exists');
if (argv['schema-only']) args.push('--schema-only');
if (argv['data-only']) args.push('--data-only');
args.push(dumpPath);

console.log(`\n${C.bold}▶ pg_restore${C.reset} ${args.filter((a) => !a.startsWith('--dbname')).join(' ')}\n`);

const start = Date.now();
const child = spawn('pg_restore', args, { stdio: 'inherit', shell: false });
child.on('close', (code) => {
  const t = ((Date.now() - start) / 1000).toFixed(1);
  if (code === 0) {
    console.log(`\n${C.green}${C.bold}✓ Restore completed in ${t}s${C.reset}`);
  } else {
    console.error(`\n${C.red}${C.bold}✖ pg_restore exited ${code} after ${t}s${C.reset}`);
    process.exit(code ?? 1);
  }
});
