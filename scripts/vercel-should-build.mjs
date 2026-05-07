#!/usr/bin/env node
/**
 * Vercel uses this script's exit code to decide whether to proceed with a
 * build for a given commit:
 *   exit 0 → skip the build
 *   exit 1 → run the build
 *
 * We only build when the commit actually touched the web app, its shared
 * packages, or workspace tooling. Everything else (realtime, desktop, infra,
 * docs) is a no-op for Vercel.
 *
 * https://vercel.com/docs/git/skip-builds
 */
import { execSync } from 'node:child_process';

const TRACKED = [
    /^apps\/web\//,
    /^packages\//,
    /^pnpm-lock\.yaml$/,
    /^pnpm-workspace\.yaml$/,
    /^turbo\.json$/,
    /^tsconfig\.base\.json$/,
    /^vercel\.json$/,
];

const ZERO_SHA = '0000000000000000000000000000000000000000';

function build(reason) {
    console.log(`✓ ${reason} — proceeding with build.`);
    process.exit(1);
}

function skip(reason) {
    console.log(`• ${reason} — skipping Vercel build.`);
    process.exit(0);
}

// Vercel injects these on every build:
//   VERCEL_GIT_COMMIT_SHA   — the commit being built
//   VERCEL_GIT_PREVIOUS_SHA — last successful production build (empty on first deploy)
const head = process.env.VERCEL_GIT_COMMIT_SHA || 'HEAD';
const prev = process.env.VERCEL_GIT_PREVIOUS_SHA;

if (!prev || prev === ZERO_SHA) {
    build('First deploy (no previous build to diff against)');
}

let files = [];
try {
    const out = execSync(`git diff --name-only ${prev} ${head}`, { encoding: 'utf8' });
    files = out.split('\n').filter(Boolean);
} catch (err) {
    build(`Could not diff ${prev}..${head} (${err.message})`);
}

if (files.length === 0) {
    build('No files reported in diff (defensive build)');
}

const matched = files.filter((f) => TRACKED.some((r) => r.test(f)));
if (matched.length > 0) {
    console.log(`  matched: ${matched.slice(0, 10).join(', ')}${matched.length > 10 ? ` (+${matched.length - 10})` : ''}`);
    build('Web-relevant changes detected');
}

skip(`No web changes in ${files.length} file(s)`);
