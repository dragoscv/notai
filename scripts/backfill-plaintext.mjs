#!/usr/bin/env node
/**
 * notai · backfill notes.plaintext from the persisted Y.Doc state.
 *
 * Why this exists
 * ───────────────
 * Until commit 4f594e1, the Hocuspocus store hook walked only the legacy
 * TipTap-via-blocks Y shape when mirroring scene text into notes.plaintext.
 * Native Excalidraw notes (post canvas-first migration) therefore stored
 * an empty plaintext, which silently broke:
 *   - dashboard NoteCard previews (NoteCard.previewHtml)
 *   - SmartLinkChip / NoteLinkPreviews / SmartPasteBanner
 *   - search ranking + AI context windows (morning brief, chat-with-note)
 *
 * This script re-derives plaintext for every non-encrypted note that has
 * a yjsState blob, applies the same extractor as the realtime server,
 * and writes it back. Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/backfill-plaintext.mjs --env=local
 *   node scripts/backfill-plaintext.mjs --env=production --yes
 *   node scripts/backfill-plaintext.mjs --env=production --dry-run
 *   node scripts/backfill-plaintext.mjs --env=production --only-empty=false   # rewrite all
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import postgres from 'postgres';
import * as Y from 'yjs';

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
const isProd = envName === 'production';
const dryRun = !!args['dry-run'];
const autoYes = !!args.yes || !!process.env.CI;
const onlyEmpty = args['only-empty'] === 'false' ? false : true;
const batchSize = Number(args.batch ?? 100);

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const envFile = join(repoRoot, isProd ? '.env.production' : '.env.local');

if (process.env.DATABASE_URL) {
  console.warn(`! Stripping pre-existing DATABASE_URL from shell env (will use ${envFile})`);
  delete process.env.DATABASE_URL;
}

if (!existsSync(envFile)) {
  if (isProd) {
    console.warn(`! ${envFile} not found — pulling from Vercel.`);
    const r = spawnSync(
      'vercel',
      ['env', 'pull', envFile, '--environment=production', '--yes'],
      { stdio: 'inherit', shell: true, cwd: join(repoRoot, 'apps/web') },
    );
    if (r.status !== 0) {
      console.error(`vercel env pull failed (exit ${r.status})`);
      process.exit(1);
    }
  } else {
    console.error(`${envFile} not found.`);
    process.exit(1);
  }
}

const envVars = parseDotenv(readFileSync(envFile, 'utf8'));
const databaseUrl = envVars.DATABASE_URL;
if (!databaseUrl) {
  console.error(`DATABASE_URL not set in ${envFile}`);
  process.exit(1);
}

const target = parseDbUrl(databaseUrl);
console.log('');
console.log(`  notai · backfill plaintext · ${envName}`);
console.log('  ─────────────────────────────────────────────');
console.log(`  env file     ${relativePath(envFile)}`);
console.log(`  target host  ${target.host}:${target.port}`);
console.log(`  target db    ${target.database}`);
console.log(`  mode         ${dryRun ? 'DRY RUN' : isProd ? 'PRODUCTION (writes)' : 'LOCAL (writes)'}`);
console.log(`  scope        ${onlyEmpty ? 'notes with empty plaintext only' : 'ALL non-encrypted notes'}`);
console.log('');

if (isProd && !dryRun && !autoYes) {
  const ok = await confirm('Type "apply" to continue: ', 'apply');
  if (!ok) {
    console.log('Aborted.');
    process.exit(0);
  }
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  onnotice: () => {},
  ssl: target.host.includes('localhost') || target.host.startsWith('127.') ? false : 'prefer',
});

const [{ count: total }] = await sql`
  select count(*)::int as count
  from notes
  where yjs_state is not null
    and is_encrypted = false
    ${onlyEmpty ? sql`and (plaintext is null or plaintext = '')` : sql``}
`;
console.log(`Found ${total} note(s) to process.`);
if (total === 0) {
  await sql.end();
  process.exit(0);
}

let processed = 0;
let updated = 0;
let unchanged = 0;
let failed = 0;
let lastId = '';

while (processed < total) {
  const rows = await sql`
    select id, yjs_state, plaintext
    from notes
    where yjs_state is not null
      and is_encrypted = false
      ${onlyEmpty ? sql`and (plaintext is null or plaintext = '')` : sql``}
      and id > ${lastId}
    order by id asc
    limit ${batchSize}
  `;
  if (rows.length === 0) break;

  for (const row of rows) {
    processed += 1;
    lastId = row.id;
    let extracted = '';
    try {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(row.yjs_state));
      extracted = extractPlaintext(doc);
    } catch (err) {
      failed += 1;
      console.warn(`  ! ${row.id} — extract failed: ${err.message}`);
      continue;
    }

    if ((row.plaintext ?? '') === extracted) {
      unchanged += 1;
      continue;
    }

    if (!dryRun) {
      await sql`update notes set plaintext = ${extracted} where id = ${row.id}`;
    }
    updated += 1;
    if (updated <= 5 || updated % 50 === 0) {
      const preview = extracted.slice(0, 60).replace(/\s+/g, ' ');
      console.log(`  ✔ ${row.id}  ${preview}${extracted.length > 60 ? '…' : ''}`);
    }
  }

  process.stdout.write(`\r  progress: ${processed}/${total}  updated=${updated}  unchanged=${unchanged}  failed=${failed}   `);
}

console.log('');
console.log('');
console.log(`Done. processed=${processed}  updated=${updated}  unchanged=${unchanged}  failed=${failed}`);
if (dryRun) console.log('(dry run — no rows written)');

await sql.end();

// ──────────────────────────────────────────────────────────────────────
// Same extractor as apps/realtime-server/src/index.ts. Keep in sync.
// ──────────────────────────────────────────────────────────────────────
function extractPlaintext(doc) {
  try {
    const parts = [];

    const excaliMap = doc.getMap('excalidraw');
    const rawElements = excaliMap.get('elements');
    if (Array.isArray(rawElements)) {
      for (const el of rawElements) {
        if (!el || typeof el !== 'object') continue;
        if (el.isDeleted) continue;
        const text =
          (typeof el.originalText === 'string' && el.originalText) ||
          (typeof el.text === 'string' && el.text) ||
          '';
        const trimmed = text.trim();
        if (trimmed) parts.push(trimmed);
      }
    }

    const scene = doc.getMap('scene');
    const blocks = scene.get('blocks');
    const blockArr =
      blocks && typeof blocks.toArray === 'function' ? blocks.toArray() : [];
    const contentMap = doc.getMap('blocks-content');
    for (const block of blockArr) {
      let frag = null;
      if (block.id === '__legacy__') {
        const main = doc.getXmlFragment('default');
        const alt = doc.getXmlFragment('prosemirror');
        frag = main.length > 0 ? main : alt.length > 0 ? alt : main;
      } else {
        const candidate = contentMap.get(block.id);
        if (candidate && typeof candidate.toString === 'function') frag = candidate;
      }
      if (frag) {
        const t = stripXml(frag.toString());
        if (t) parts.push(t);
      }
    }

    if (parts.length === 0) {
      for (const name of ['default', 'prosemirror']) {
        const t = stripXml(doc.getXmlFragment(name).toString());
        if (t) parts.push(t);
      }
    }

    return parts.join('\n').slice(0, 100_000);
  } catch {
    return '';
  }
}

function stripXml(xml) {
  if (!xml) return '';
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

// ──────────────────────────────────────────────────────────────────────
// Tiny utils
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

function relativePath(p) {
  return p.startsWith(repoRoot) ? '.' + p.slice(repoRoot.length).replace(/\\/g, '/') : p;
}

async function confirm(prompt, expected) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(prompt, (a) => {
      rl.close();
      res(a.trim() === expected);
    });
  });
}
