#!/usr/bin/env node
/**
 * Reports whether changes in a git range affect the Notai desktop app and
 * therefore warrant bumping `apps/desktop/package.json`.
 *
 * The desktop main window loads `https://notai.ro/app` (remote content),
 * so most web-only changes ship to desktop users automatically the next
 * time they reload — no installer rebuild needed.
 *
 * A new desktop release IS needed when the change touches one of:
 *
 *   1. Anything under `apps/desktop/src-tauri/**` — Rust code, capabilities,
 *      tauri.conf.json, NSIS template, hooks, icons.
 *   2. Web code that calls a Tauri command, plugin, or internal that wasn't
 *      already invoked from a desktop release. New ACL surface = new
 *      capability entries = new Rust binary.
 *
 * This script is informational. It prints a summary and exits 0 even on
 * "warn" — so it never blocks a push. Use `--strict` to exit 1 on warn.
 *
 * Usage:
 *   node scripts/check-desktop-impact.mjs               # diff vs origin/main
 *   node scripts/check-desktop-impact.mjs <base> [head]
 *   node scripts/check-desktop-impact.mjs --strict
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2).filter((a) => a !== '--strict');
const strict = process.argv.includes('--strict');

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function safeGit(cmd) {
  try {
    return git(cmd);
  } catch {
    return '';
  }
}

// Resolve base/head. Default base = the merge-base with origin/main (or HEAD~1
// for the first commit on a branch / detached HEAD).
const head = args[1] || 'HEAD';
let base = args[0];
if (!base) {
  base =
    safeGit('merge-base origin/main HEAD') ||
    safeGit('rev-parse HEAD~1') ||
    safeGit('rev-parse HEAD');
}
if (!base) {
  console.log('desktop-impact: no git history yet, skipping.');
  process.exit(0);
}

const range = `${base}..${head}`;
const changed = safeGit(`diff --name-only ${range}`).split('\n').filter(Boolean);

if (changed.length === 0) {
  console.log(`desktop-impact: no changes in ${range}.`);
  process.exit(0);
}

// 1. Direct desktop changes (always require a bump).
const directDesktop = changed.filter((f) => f.startsWith('apps/desktop/src-tauri/'));

// 2. Web changes that touch Tauri command/plugin/internals surface. Only
//    flag the patterns that imply a new ACL entry — generic UI tweaks pass.
const TAURI_PATTERNS = [
  /@tauri-apps\/[\w-]+/g, // any plugin import
  /__TAURI_INTERNALS__/g,
  /['"]plugin:[\w-]+\|[\w-]+['"]/g, // invoke('plugin:foo|bar')
  /tauri::command/g, // shouldn't appear in web/, but flag if it does
];

const webChanged = changed.filter(
  (f) =>
    (f.startsWith('apps/web/') || f.startsWith('packages/')) &&
    !f.endsWith('.md') &&
    !f.endsWith('.lock') &&
    /\.(ts|tsx|js|jsx|mjs|cjs|rs)$/.test(f),
);

const tauriHits = [];
for (const file of webChanged) {
  if (!existsSync(file)) continue; // deleted in this range
  const text = readFileSync(file, 'utf8');
  for (const re of TAURI_PATTERNS) {
    const matches = text.match(re);
    if (matches?.length) {
      tauriHits.push({ file, hits: [...new Set(matches)] });
      break;
    }
  }
}

// 3. Was the desktop version actually bumped in this range?
function pkgVersion(ref) {
  const out = safeGit(`show ${ref}:apps/desktop/package.json`);
  if (!out) return null;
  try {
    return JSON.parse(out).version ?? null;
  } catch {
    return null;
  }
}
const baseVersion = pkgVersion(base);
const headVersion = pkgVersion(head);
const bumped = baseVersion && headVersion && baseVersion !== headVersion;

const needs = directDesktop.length > 0;
const recommend = tauriHits.length > 0 && !needs;

const banner = '─'.repeat(60);
console.log(banner);
console.log('Desktop-app impact summary');
console.log(`  range:           ${range}`);
console.log(
  `  desktop version: ${baseVersion ?? '?'} → ${headVersion ?? '?'}${bumped ? ' (bumped)' : ''}`,
);
console.log(banner);

if (directDesktop.length) {
  console.log(`\n  REQUIRES desktop bump (${directDesktop.length} native file(s) changed):`);
  for (const f of directDesktop.slice(0, 20)) console.log(`    - ${f}`);
  if (directDesktop.length > 20) console.log(`    … and ${directDesktop.length - 20} more`);
}

if (tauriHits.length) {
  console.log(
    `\n  RECOMMEND review (${tauriHits.length} web file(s) reference the Tauri ACL surface):`,
  );
  for (const { file, hits } of tauriHits.slice(0, 15)) {
    console.log(`    - ${file}`);
    console.log(`        ${hits.slice(0, 3).join(', ')}${hits.length > 3 ? ', …' : ''}`);
  }
  if (tauriHits.length > 15) console.log(`    … and ${tauriHits.length - 15} more`);
  console.log(
    '\n    If any of the referenced commands/plugins are NEW, add the\n' +
      '    matching permission to apps/desktop/src-tauri/capabilities/default.json\n' +
      '    and bump apps/desktop/package.json. Otherwise this is informational.',
  );
}

if (!needs && !recommend) {
  console.log('\n  ✓ Web-only change. Ships to desktop on next webview reload.');
  process.exit(0);
}

if (needs && !bumped) {
  console.log('\n  ✗ Native desktop files changed but apps/desktop/package.json was NOT bumped.');
  console.log('    Bump it (and add a CHANGELOG entry) before pushing.');
  process.exit(strict ? 1 : 0);
}

if (needs && bumped) {
  console.log(`\n  ✓ Desktop version bumped to ${headVersion}.`);
}

if (recommend) {
  console.log('\n  (Informational — pass `--strict` to fail on this.)');
  if (strict) process.exit(1);
}

process.exit(0);
