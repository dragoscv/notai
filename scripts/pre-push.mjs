#!/usr/bin/env node
/**
 * Pre-push gate. Intentionally LIGHT — only fast, local-only checks
 * that catch things CI cannot (or shouldn't) re-run: leaked secrets,
 * unaccounted version bumps. Build / lint / typecheck / tests run in
 * GitHub Actions on every push so pre-push stays under ~2s.
 *
 * Bypass with `git push --no-verify` if something genuinely needs to
 * land bypassing these.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isTTY = process.stdout.isTTY;
const c = (code, text) => (isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const dim = (t) => c('2', t);
const bold = (t) => c('1', t);
const red = (t) => c('31', t);
const green = (t) => c('32', t);
const yellow = (t) => c('33', t);
const cyan = (t) => c('36', t);

const STEPS = [
  {
    name: 'Version-bump audit',
    cmd: 'node',
    args: ['scripts/version-bump-audit.mjs'],
    hint: 'See scripts/version-bump-audit.mjs — bumps must include a CHANGELOG entry.',
  },
  {
    name: 'Secret scan',
    cmd: 'node',
    args: ['scripts/secret-scan.mjs'],
    hint: 'Remove the secret from the file and rotate it. False positives can be silenced via `// notai-secret-scan-ignore`.',
  },
  {
    name: 'Migration drift (production)',
    cmd: 'node',
    args: ['scripts/check-migrations-pending.mjs', '--env=production', '--soft'],
    hint: 'Pending migrations would silently break SSR after deploy. Run `node scripts/migrate.mjs --env=production --backup` before pushing, or pull `.env.production` via `vercel env pull` first if this step is being skipped.',
  },
  {
    name: 'Lockfile drift',
    cmd: 'node',
    args: ['scripts/check-lockfile-drift.mjs'],
    hint: 'pnpm-lock.yaml is out of sync. Run `pnpm install` to regenerate, then commit the lockfile alongside the package.json change.',
  },
];

const VERBOSE = process.env.PREPUSH_VERBOSE === '1' || process.argv.includes('--verbose');

function run({ name, cmd, args, env }) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      shell: true,
      env: { ...process.env, ...(env ?? {}) },
      stdio: VERBOSE ? 'inherit' : 'pipe',
    });

    let buf = '';
    if (!VERBOSE) {
      child.stdout.on('data', (d) => { buf += d.toString(); });
      child.stderr.on('data', (d) => { buf += d.toString(); });
    }

    child.on('close', (code) => {
      resolve({ name, code, output: buf, ms: Date.now() - start });
    });
    child.on('error', (err) => {
      resolve({ name, code: 1, output: String(err), ms: Date.now() - start });
    });
  });
}

function tail(text, lines) {
  const arr = text.split('\n');
  return arr.slice(Math.max(0, arr.length - lines)).join('\n');
}

if (!existsSync(path.join(repoRoot, 'package.json'))) {
  console.error('pre-push: cannot find repo root');
  process.exit(1);
}

console.log(bold(cyan('▶ pre-push checks')));
console.log(
  dim(
    `  Light gate — secret scan + version-bump audit only. Lint/typecheck/build run in CI on every push.`,
  ),
);
if (VERBOSE) {
  console.log(dim('  Verbose mode: streaming all step output (PREPUSH_VERBOSE=1).'));
}

const results = [];
// All steps are pure-node and independent — run them in parallel.
async function runOne(step) {
  const t0 = Date.now();
  process.stdout.write(`  ${cyan('▶')} ${step.name} ${dim('started')}\n`);
  const r = await run(step);
  const t = `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  if (r.code === 0) {
    process.stdout.write(`  ${green('✓')} ${step.name} ${dim(`(${t})`)}\n`);
  } else {
    process.stdout.write(`  ${red('✖')} ${step.name} ${dim(`(${t}, exit ${r.code})`)}\n`);
  }
  return { ...r, step };
}
results.push(...(await Promise.all(STEPS.map(runOne))));

const failures = results.filter((r) => r.code !== 0);
if (failures.length === 0) {
  console.log();
  console.log(green('✓ All pre-push checks passed.'));
  process.exit(0);
}

console.log();
console.log(red(bold(`✖ ${failures.length} pre-push check(s) failed`)));
for (const f of failures) {
  console.log();
  console.log(yellow(bold(`── ${f.step.name} ────────────────────────────────────────`)));
  console.log(tail(f.output.trimEnd(), 60));
  console.log(dim(`hint: ${f.step.hint}`));
}
console.log();
console.log(
  dim(
    'Re-run the failing step locally for the full output, then push again. ' +
      'Use --no-verify only as a last resort.',
  ),
);
process.exit(1);
