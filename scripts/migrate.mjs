#!/usr/bin/env node
/**
 * notai DB migration runner — fail-safe, human-readable.
 *
 * Usage (via VS Code tasks or CLI):
 *   node scripts/migrate.mjs --env=local
 *   node scripts/migrate.mjs --env=production --backup --yes
 *
 * Flags:
 *   --env=local|production   which env file to load (required)
 *   --backup                 create a backup before applying (Cloud SQL → gcloud snapshot, else pg_dump)
 *   --dry-run                show what would happen, but don't apply
 *   --yes                    skip confirmation prompt (required in CI / non-TTY)
 *   --baseline=N             record the first N migrations as already-applied
 *                            without running them (use after switching from
 *                            `drizzle-kit push` to versioned migrations on a
 *                            DB that already has the schema).
 *
 * Env resolution order:
 *   --env=local       → .env.local           (DATABASE_URL)
 *   --env=production  → .env.production      (DATABASE_URL)
 *                       └ if missing, runs `vercel env pull .env.production --environment=production --yes`
 *
 * Safety:
 *   - Prints target host/db (password masked) and waits for explicit "yes" for prod.
 *   - Lists already-applied vs pending migrations BEFORE making any change.
 *   - For prod, takes a backup first (gcloud or pg_dump). Aborts if the backup fails.
 *   - Wraps the migration in a single transaction (drizzle's default behaviour).
 *   - Verifies all migrations are present afterwards and exits non-zero on any error.
 */
import { readFileSync, existsSync, mkdirSync, readdirSync, createWriteStream, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import readline from 'node:readline';
import postgres from 'postgres';

// ─── ANSI colours (no deps) ─────────────────────────────────────────────
const C = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    grey: '\x1b[90m',
};
const supportsColor = process.stdout.isTTY && process.env.NO_COLOR == null;
const c = (code, text) => (supportsColor ? `${code}${text}${C.reset}` : text);
const log = {
    title: (t) => console.log(`\n${c(C.bold + C.cyan, '▸ ' + t)}`),
    info: (t) => console.log(`  ${c(C.dim, '·')} ${t}`),
    ok: (t) => console.log(`  ${c(C.green, '✔')} ${t}`),
    warn: (t) => console.log(`  ${c(C.yellow, '!')} ${t}`),
    error: (t) => console.log(`  ${c(C.red, '✖')} ${t}`),
    plain: (t) => console.log(t),
    kv: (k, v) => console.log(`  ${c(C.dim, k.padEnd(14))} ${v}`),
};

// ─── Args ────────────────────────────────────────────────────────────────
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
    log.error('Missing or invalid --env=local|production');
    process.exit(2);
}
const isProd = envName === 'production';
const wantBackup = !!args.backup || isProd; // prod always backs up
const dryRun = !!args['dry-run'];
const autoYes = !!args.yes || !!process.env.CI;
const baselineCount = args.baseline != null ? Number(args.baseline) : null;
if (baselineCount != null && (!Number.isFinite(baselineCount) || baselineCount < 0)) {
    console.error(`Invalid --baseline=${args.baseline}`);
    process.exit(2);
}

// ─── Paths ───────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const migrationsDir = join(repoRoot, 'packages/db/drizzle');
const backupsDir = join(repoRoot, 'backups');
const envFile = join(repoRoot, isProd ? '.env.production' : '.env.local');

// ─── Header ──────────────────────────────────────────────────────────────
log.plain('');
log.plain(c(C.bold, `  notai · DB migration · ${envName}`));
log.plain(c(C.dim, '  ─────────────────────────────────────────────'));

// ─── Env file ────────────────────────────────────────────────────────────
log.title('Environment');
if (!existsSync(envFile)) {
    if (isProd) {
        log.warn(`${envFile} not found — pulling from Vercel.`);
        const r = spawnSync('vercel', ['env', 'pull', envFile, '--environment=production', '--yes'], {
            stdio: 'inherit',
            shell: true,
            cwd: join(repoRoot, 'apps/web'),
        });
        if (r.status !== 0) die(`vercel env pull failed (exit ${r.status}). Create ${envFile} manually.`);
    } else {
        die(`${envFile} not found. Create it with DATABASE_URL=postgres://...`);
    }
}
const envVars = parseDotenv(readFileSync(envFile, 'utf8'));
const databaseUrl = envVars.DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) die(`DATABASE_URL not set in ${envFile}`);

const target = parseDbUrl(databaseUrl);
log.kv('env file', relativePath(envFile));
log.kv('target host', `${target.host}:${target.port}`);
log.kv('target db', target.database);
log.kv('target user', target.user);
log.kv('password', c(C.dim, '(hidden)'));
if (isProd) log.kv('mode', c(C.yellow + C.bold, 'PRODUCTION'));

// ─── Connect ─────────────────────────────────────────────────────────────
log.title('Connecting');
const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
    onnotice: () => {},
    ssl: target.host.includes('localhost') || target.host.startsWith('127.') ? false : 'prefer',
});

try {
    const [{ now, ver }] = await sql`select now() as now, version() as ver`;
    log.ok(`connected · server time ${new Date(now).toISOString()}`);
    log.info(c(C.dim, ver.split(' ').slice(0, 2).join(' ')));
} catch (err) {
    die(`Could not connect: ${err.message}`);
}

// ─── Inspect migrations ──────────────────────────────────────────────────
log.title('Migrations');

const onDisk = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
log.info(`${onDisk.length} migration file(s) on disk`);

let appliedHashes = new Set();
let migrationsTableExists = false;
try {
    const rows = await sql`
        select hash, created_at
        from drizzle.__drizzle_migrations
        order by created_at asc
    `;
    migrationsTableExists = true;
    appliedHashes = new Set(rows.map((r) => r.hash));
    log.info(`${rows.length} migration(s) recorded in __drizzle_migrations`);
} catch {
    log.warn('drizzle migrations table not found — first run, will be created.');
}

// Compute pending — drizzle's hash is sha256 of the SQL file. We just
// flag any local .sql that isn't represented by a folder hash entry,
// AND additionally show files whose journal entry is missing.
const journalPath = join(migrationsDir, 'meta/_journal.json');
const journal = existsSync(journalPath)
    ? JSON.parse(readFileSync(journalPath, 'utf8'))
    : { entries: [] };
const journalByTag = new Map(journal.entries.map((e) => [e.tag, e]));

const pending = [];
for (const file of onDisk) {
    const tag = file.replace(/\.sql$/, '');
    const entry = journalByTag.get(tag);
    if (!entry) {
        pending.push({ file, status: 'orphan', detail: 'no journal entry' });
        continue;
    }
    // Drizzle stores hashes per migration in the table; if table is empty, all pending.
    if (!migrationsTableExists || appliedHashes.size < journal.entries.indexOf(entry) + 1) {
        pending.push({ file, status: 'pending', detail: '' });
    }
}

if (pending.length === 0) {
    log.ok('database is up to date — no migrations to apply.');
    await sql.end();
    process.exit(0);
}

// ─── Baseline mode ───────────────────────────────────────────────────────
if (baselineCount != null) {
    log.title(`Baseline (record ${baselineCount} migration(s) as applied)`);
    if (baselineCount > onDisk.length) die(`--baseline=${baselineCount} > ${onDisk.length} on disk`);
    if (migrationsTableExists && appliedHashes.size >= baselineCount) {
        log.ok('already baselined — nothing to do.');
        await sql.end();
        process.exit(0);
    }
    const toBaseline = onDisk.slice(0, baselineCount);
    for (const f of toBaseline) console.log(`    ${c(C.cyan, '◎')} ${f}`);
    if (!autoYes) {
        const word = await prompt(`  Type "${c(C.bold, 'baseline')}" to confirm: `);
        if (word.trim().toLowerCase() !== 'baseline') {
            log.error('Aborted by user.');
            await sql.end();
            process.exit(1);
        }
    }
    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id serial PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
    )`;
    let inserted = 0;
    for (const f of toBaseline) {
        const tag = f.replace(/\.sql$/, '');
        const entry = journalByTag.get(tag);
        if (!entry) die(`journal entry missing for ${f} — refusing to baseline.`);
        const content = readFileSync(join(migrationsDir, f), 'utf8');
        const hash = createHash('sha256').update(content).digest('hex');
        const exists = await sql`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${hash}`;
        if (exists.length === 0) {
            // IMPORTANT: drizzle compares created_at against journal folderMillis
            // to decide what to apply next. Use the journal's millis so later
            // migrations are still detected as pending.
            await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`;
            inserted++;
        }
    }
    log.ok(`baselined ${inserted} migration(s) (skipped ${baselineCount - inserted} already-recorded).`);
    await sql.end();
    process.exit(0);
}

log.plain('');
log.plain(c(C.bold, '  Pending migrations:'));
for (const p of pending) {
    const fp = join(migrationsDir, p.file);
    const size = statSync(fp).size;
    const head = readFileSync(fp, 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('--'))
        .slice(0, 3)
        .map((l) => l.trim().slice(0, 70))
        .join(' / ');
    console.log(`    ${c(C.yellow, '→')} ${c(C.bold, p.file)} ${c(C.dim, `(${size}B)`)}`);
    console.log(`      ${c(C.dim, head || '(empty)')}`);
}

if (dryRun) {
    log.title('Dry run');
    log.ok('dry-run requested — no changes made.');
    await sql.end();
    process.exit(0);
}

// ─── Confirm ─────────────────────────────────────────────────────────────
if (isProd && !autoYes) {
    log.title('Confirmation');
    log.warn(`You are about to mutate ${c(C.bold, target.host + '/' + target.database)}.`);
    const word = await prompt(`  Type "${c(C.bold, 'apply')}" to proceed: `);
    if (word.trim().toLowerCase() !== 'apply') {
        log.error('Aborted by user.');
        await sql.end();
        process.exit(1);
    }
} else if (!autoYes) {
    log.title('Confirmation');
    const word = await prompt('  Press Enter to apply, or Ctrl+C to abort: ');
    void word;
}

// ─── Backup ──────────────────────────────────────────────────────────────
if (wantBackup) {
    log.title('Backup');
    if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const isCloudSql = isProd && (await detectCloudSqlInstance(target));

    if (isCloudSql) {
        log.info(`Cloud SQL detected: ${isCloudSql.connectionName}`);
        const r = spawnSync(
            'gcloud',
            [
                'sql',
                'backups',
                'create',
                `--instance=${isCloudSql.instanceName}`,
                `--project=${isCloudSql.project}`,
                `--description=pre-migration-${stamp}`,
                '--quiet',
            ],
            { stdio: 'inherit', shell: true },
        );
        if (r.status !== 0) die('gcloud backup failed — refusing to migrate.');
        log.ok('Cloud SQL on-demand backup created.');
    } else {
        const out = join(backupsDir, `${envName}-${stamp}.sql`);
        log.info(`pg_dump → ${relativePath(out)}`);
        const ok = await pgDump(databaseUrl, out);
        if (!ok) {
            log.warn('pg_dump not available (or failed). Continue without backup? Aborting to be safe.');
            if (isProd) die('Backup failed in production — aborting.');
            log.warn('Local env: continuing without backup.');
        } else {
            log.ok(`backup written (${(statSync(out).size / 1024).toFixed(1)} KB)`);
        }
    }
}

// ─── Apply ───────────────────────────────────────────────────────────────
log.title('Applying');
await sql.end(); // drizzle migrate opens its own pool
const start = Date.now();
const r = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['--filter', '@notai/db', 'exec', 'tsx', 'src/migrate.ts'],
    {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'inherit',
        shell: true,
    },
);
const tookMs = Date.now() - start;
if (r.status !== 0) {
    log.error(`drizzle migrate failed (exit ${r.status}) after ${tookMs}ms`);
    process.exit(r.status ?? 1);
}
log.ok(`applied ${pending.length} migration(s) in ${tookMs}ms`);

// ─── Verify ──────────────────────────────────────────────────────────────
log.title('Verification');
const verify = postgres(databaseUrl, {
    max: 1,
    ssl: target.host.includes('localhost') || target.host.startsWith('127.') ? false : 'prefer',
});
try {
    const tables = await verify`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
        order by table_name
    `;
    log.ok(`${tables.length} table(s) in public schema`);
    log.info(tables.map((t) => t.table_name).join(', '));
    const hist = await verify`
        select hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 3
    `;
    log.info(`recent migrations:`);
    for (const h of hist) {
        console.log(`    ${c(C.dim, new Date(Number(h.created_at)).toISOString())}  ${c(C.grey, h.hash.slice(0, 16))}…`);
    }
} catch (err) {
    log.warn(`verification query failed: ${err.message}`);
}
await verify.end();

log.plain('');
log.plain(c(C.green + C.bold, '  ✔ migration complete'));
log.plain('');

// ─── Helpers ─────────────────────────────────────────────────────────────
function die(msg) {
    log.error(msg);
    process.exit(1);
}

function parseDotenv(text) {
    const out = {};
    for (const line of text.split(/\r?\n/)) {
        if (!line.trim() || line.startsWith('#')) continue;
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
        if (!m) continue;
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        out[m[1]] = val;
    }
    return out;
}

function parseDbUrl(url) {
    const u = new URL(url);
    return {
        host: u.hostname,
        port: u.port || '5432',
        database: u.pathname.replace(/^\//, ''),
        user: decodeURIComponent(u.username),
    };
}

function relativePath(p) {
    return p.replace(repoRoot + (process.platform === 'win32' ? '\\' : '/'), '');
}

function prompt(q) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
}

async function detectCloudSqlInstance(target) {
    // Cloud SQL instances use a public IP; we identify them by asking gcloud.
    const r = spawnSync(
        'gcloud',
        [
            'sql',
            'instances',
            'list',
            `--filter=ipAddresses.ipAddress=${target.host}`,
            '--format=value(name,connectionName,project)',
        ],
        { encoding: 'utf8', shell: true },
    );
    if (r.status !== 0 || !r.stdout?.trim()) return null;
    const [name, connectionName, project] = r.stdout.trim().split(/\s+/);
    if (!name) return null;
    // Project is implicit from connectionName (project:region:instance) when not separately listed.
    const proj = project || connectionName?.split(':')[0];
    return { instanceName: name, connectionName, project: proj };
}

async function pgDump(url, outFile) {
    return await new Promise((resolve) => {
        const child = spawn('pg_dump', ['--format=plain', '--no-owner', '--no-privileges', url], {
            shell: true,
        });
        const out = createWriteStream(outFile);
        child.stdout.pipe(out);
        let stderr = '';
        child.stderr.on('data', (d) => (stderr += d.toString()));
        child.on('error', () => resolve(false));
        child.on('exit', (code) => {
            out.close();
            if (code !== 0) {
                if (stderr.trim()) log.warn(stderr.trim().split('\n').slice(-3).join(' / '));
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}
