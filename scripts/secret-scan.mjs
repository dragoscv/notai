#!/usr/bin/env node
/**
 * Pre-push secret scanner. Greps the staged push range (or the whole
 * working tree as a fallback) for high-confidence secret patterns and
 * fails the push if any are found. Safe to run repeatedly — pure read.
 *
 * Patterns are intentionally narrow: short / well-known prefixes that
 * almost never appear by accident. False positives can be allow-listed
 * by adding the offending file to ALLOW_FILES below or wrapping the
 * literal in a `// notai-secret-scan-ignore` line comment.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PATTERNS = [
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'AWS secret key (likely)', re: /\baws_secret_access_key\s*[:=]\s*['"][A-Za-z0-9/+=]{40}['"]/i },
  { name: 'GitHub PAT', re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: 'GitHub OAuth token', re: /\bgho_[A-Za-z0-9]{36}\b/ },
  { name: 'GitHub App token', re: /\b(ghu|ghs)_[A-Za-z0-9]{36}\b/ },
  { name: 'Stripe live secret', re: /\bsk_live_[A-Za-z0-9]{24,}\b/ },
  { name: 'Stripe live publishable', re: /\bpk_live_[A-Za-z0-9]{24,}\b/ },
  { name: 'Stripe webhook secret', re: /\bwhsec_[A-Za-z0-9]{32,}\b/ },
  { name: 'Slack bot token', re: /\bxoxb-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google OAuth client secret', re: /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'OpenAI key', re: /\bsk-(proj-)?[A-Za-z0-9_-]{40,}\b/ },
  { name: 'Anthropic key', re: /\bsk-ant-[A-Za-z0-9_-]{40,}\b/ },
  { name: 'Generic 32+ hex API key in literal', re: /['"][a-f0-9]{40,}['"]/i, soft: true },
  { name: 'Private key block', re: /-----BEGIN (RSA|OPENSSH|EC|DSA|PGP) PRIVATE KEY-----/ },
];

// Files we explicitly don't scan — generated, vendored, lockfiles, etc.
const ALLOW_FILES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'CHANGELOG.md',
  // The pre-push checker itself contains the patterns as regexes.
  'scripts/secret-scan.mjs',
]);

const ALLOW_DIRS = ['node_modules', '.next', '.turbo', 'dist', 'build', 'coverage', '.git', 'backups'];

function listTrackedFiles() {
  const r = spawnSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('secret-scan: `git ls-files` failed; aborting');
    process.exit(2);
  }
  return r.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => !ALLOW_FILES.has(f))
    .filter((f) => !ALLOW_DIRS.some((d) => f.startsWith(`${d}/`) || f.includes(`/${d}/`)));
}

const findings = [];
let scanned = 0;

for (const rel of listTrackedFiles()) {
  const abs = path.join(repoRoot, rel);
  if (!existsSync(abs)) continue;
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    continue; // binary / unreadable
  }
  if (text.length === 0) continue;
  scanned += 1;
  // Skip lines that opt out via comment.
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('notai-secret-scan-ignore')) continue;
    for (const p of PATTERNS) {
      if (p.re.test(line)) {
        // For the "soft" hex-blob pattern, require the file path to look
        // like real config or env material to cut down on noise from
        // commit hashes and SRI strings.
        if (p.soft && !/(\.env|secrets?|credentials?|key)/i.test(rel)) continue;
        findings.push({ file: rel, line: i + 1, pattern: p.name, snippet: line.trim().slice(0, 120) });
      }
    }
  }
}

if (findings.length === 0) {
  console.log(`✓ secret-scan: no matches in ${scanned} tracked file(s).`);
  process.exit(0);
}

console.error(`✖ secret-scan: ${findings.length} potential secret(s) found:`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  [${f.pattern}]  ${f.snippet}`);
}
console.error('');
console.error('If this is a false positive, append `// notai-secret-scan-ignore` to the line');
console.error('or add the file to ALLOW_FILES in scripts/secret-scan.mjs.');
process.exit(1);
