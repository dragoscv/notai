#!/usr/bin/env node
/**
 * notai · lockfile drift check.
 *
 * `pnpm install --frozen-lockfile --lockfile-only` succeeds only when
 * pnpm-lock.yaml is in sync with every workspace package.json. Pushing
 * a drifted lockfile breaks Vercel installs because vercel.json pins
 * `pnpm install --frozen-lockfile`. We saw this happen in May 2026 —
 * builds 500'd for ~24h.
 *
 * Used by scripts/pre-push.mjs.
 */
import { spawnSync } from 'node:child_process';

const r = spawnSync('pnpm', ['install', '--frozen-lockfile', '--lockfile-only'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
  encoding: 'utf8',
});

if (r.status === 0) {
  console.log('✓ pnpm-lock.yaml is in sync with every workspace package.json.');
  process.exit(0);
}

const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
console.error('');
console.error('✖ pnpm-lock.yaml is out of sync with one or more package.json files.');
console.error('  Vercel installs use --frozen-lockfile and will hard-fail.');
console.error('');
if (out) {
  const tail = out.split(/\r?\n/).slice(-25).join('\n');
  console.error(tail);
  console.error('');
}
console.error('Fix:');
console.error('    pnpm install            # regenerates the lockfile');
console.error('    git add pnpm-lock.yaml');
console.error('');
process.exit(1);
