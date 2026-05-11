#!/usr/bin/env node
/**
 * Pre-push gate. Runs the full quality bar locally so broken code never
 * leaves the machine. Each step prints a single-line status; failures get
 * a grouped, syntax-highlighted error tail so you can fix and re-push
 * without scrolling through thousands of lines.
 *
 * Bypass with `git push --no-verify` only when truly necessary — CI
 * (`.github/workflows/ci.yml`) re-runs the same checks as a backstop.
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

// Build needs *some* env vars for Next's static analysis. These are dummy.
const BUILD_ENV = {
  DATABASE_URL: 'postgres://ci:ci@localhost:5432/ci',
  AUTH_SECRET: 'prepush-only-not-a-real-secret-prepush-only-32',
  AUTH_TRUST_HOST: 'true',
  AUTH_GOOGLE_ID: 'prepush',
  AUTH_GOOGLE_SECRET: 'prepush',
  HOCUSPOCUS_JWT_SECRET: 'prepush-only-not-a-real-secret-prepush-only-32',
  NEXT_PUBLIC_HOCUSPOCUS_URL: 'ws://localhost:4040',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  CI: '1',
  SERWIST_SUPPRESS_TURBOPACK_WARNING: '1',
};

const STEPS = [
  {
    name: 'Lint',
    cmd: 'pnpm',
    args: ['lint'],
    hint: 'Run `pnpm lint --filter <pkg>` for a single package, or use `pnpm exec eslint --fix <file>`.',
  },
  {
    name: 'Typecheck',
    cmd: 'pnpm',
    args: ['typecheck'],
    hint: 'Open the file:line printed below; tsc errors are file:line:col.',
  },
  {
    name: 'Format check',
    cmd: 'pnpm',
    args: ['format:check'],
    hint: 'Auto-fix with `pnpm format`.',
  },
  {
    name: 'Build (web + realtime)',
    cmd: 'pnpm',
    args: ['build'],
    env: BUILD_ENV,
    hint: 'Reproduce locally with the same env vars; this is what Vercel/Cloud Run will run.',
  },
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
];

const VERBOSE = process.env.PREPUSH_VERBOSE === '1' || process.argv.includes('--verbose');
const HEARTBEAT_MS = 1000;
const STATUS_MAX_COL = 100;

function lastNonEmptyLine(buf) {
  // Strip ANSI + carriage returns so transient progress bars don't garble.
  const cleaned = buf.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '\n');
  const lines = cleaned.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (l) return l;
  }
  return '';
}

function truncate(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function run({ name, cmd, args, env }) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      shell: true,
      env: { ...process.env, ...(env ?? {}) },
      // Inherit stdio in verbose mode so output streams to terminal as it happens.
      stdio: VERBOSE ? 'inherit' : 'pipe',
    });

    let buf = '';
    let heartbeat = null;
    let lastDrawWidth = 0;

    if (!VERBOSE) {
      const onData = (d) => {
        buf += d.toString();
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);

      if (isTTY) {
        const draw = () => {
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          const tail = lastNonEmptyLine(buf);
          const prefix = `  ${cyan('●')} ${name} ${dim(`(${elapsed}s)`)} `;
          // Calculate visible width without ANSI for proper clearing.
          const visibleLen = `  ● ${name} (${elapsed}s) `.length;
          const room = Math.max(20, STATUS_MAX_COL - visibleLen);
          const line = prefix + (tail ? dim(truncate(tail, room)) : dim('…'));
          // Clear the previous line then redraw.
          process.stdout.write(`\r${' '.repeat(lastDrawWidth)}\r${line}`);
          lastDrawWidth = visibleLen + Math.min(room, tail.length || 1);
        };
        draw();
        heartbeat = setInterval(draw, HEARTBEAT_MS);
      }
    }

    child.on('close', (code) => {
      if (heartbeat) clearInterval(heartbeat);
      if (!VERBOSE && isTTY && lastDrawWidth > 0) {
        // Erase the heartbeat line so the final ✓/✖ printed by the caller is clean.
        process.stdout.write(`\r${' '.repeat(lastDrawWidth)}\r`);
      }
      resolve({ name, code, output: buf, ms: Date.now() - start });
    });

    child.on('error', (err) => {
      if (heartbeat) clearInterval(heartbeat);
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
    `  Bypass with --no-verify at your own risk — quality is no longer re-checked in CI. Logs collapsed; failures expand.`,
  ),
);
if (VERBOSE) {
  console.log(dim('  Verbose mode: streaming all step output (PREPUSH_VERBOSE=1).'));
} else {
  console.log(
    dim(
      '  Tip: re-run with `$env:PREPUSH_VERBOSE=1; git push` to stream live output for slow steps.',
    ),
  );
}

const results = [];
for (const step of STEPS) {
  if (VERBOSE) {
    console.log();
    console.log(cyan(`▶ ${step.name}`));
  }
  const r = await run(step);
  results.push({ ...r, step });
  const t = `${(r.ms / 1000).toFixed(1)}s`;
  if (r.code === 0) {
    process.stdout.write(`  ${green('✓')} ${step.name} ${dim(`(${t})`)}\n`);
  } else {
    process.stdout.write(`  ${red('✖')} ${step.name} ${dim(`(${t}, exit ${r.code})`)}\n`);
  }
}

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
