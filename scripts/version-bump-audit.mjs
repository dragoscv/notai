#!/usr/bin/env node
/**
 * Audits the *current working tree* (not just staged files) for version
 * bumps that don't have a matching CHANGELOG.md entry. Used by the
 * pre-push hook so it covers commits that were made with --no-verify.
 *
 * Exits 0 when there's nothing to flag. Exits 1 with a plain-English
 * report otherwise.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

// Compare HEAD against origin/main (or origin/master). On the branch
// being pushed this gives us the actual delta the push contains.
let upstream = 'origin/main';
try {
  git(`rev-parse --verify ${upstream}`);
} catch {
  try {
    git('rev-parse --verify origin/master');
    upstream = 'origin/master';
  } catch {
    console.log('skip: no upstream main/master to diff against.');
    process.exit(0);
  }
}

let changed;
try {
  changed = git(`diff --name-only ${upstream}...HEAD -- '**/package.json' 'package.json'`)
    .split('\n')
    .filter(Boolean);
} catch {
  process.exit(0);
}

if (changed.length === 0) {
  console.log('no version-bumpable files changed.');
  process.exit(0);
}

const bumps = [];
for (const file of changed) {
  let head, base;
  try {
    head = JSON.parse(git(`show HEAD:${file}`));
  } catch {
    continue;
  }
  try {
    base = JSON.parse(git(`show ${upstream}:${file}`));
  } catch {
    continue;
  }
  if (head.version && head.version !== base.version) {
    bumps.push({ file, name: head.name, version: head.version });
  }
}

if (bumps.length === 0) {
  console.log('no version bumps in this push.');
  process.exit(0);
}

const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
if (!existsSync(changelogPath)) {
  console.error('✖ Version bump detected but CHANGELOG.md is missing at repo root.');
  process.exit(1);
}
const changelog = readFileSync(changelogPath, 'utf8');

const missing = bumps.filter(
  (b) => !changelog.includes(`[${b.version}]`) && !changelog.includes(b.version),
);

if (missing.length > 0) {
  console.error('✖ Version bump(s) without a matching CHANGELOG.md entry:');
  for (const m of missing) console.error(`    • ${m.name} → ${m.version} (${m.file})`);
  console.error('  Add a section to CHANGELOG.md and amend / commit before pushing.');
  process.exit(1);
}

console.log(`✓ ${bumps.length} version bump(s) covered by CHANGELOG.md.`);
process.exit(0);
