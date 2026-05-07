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
];

function changedFiles() {
    try {
        const out = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' });
        return out.split('\n').filter(Boolean);
    } catch {
        return ['__force__'];
    }
}

const files = changedFiles();
const shouldBuild = files.some((f) => TRACKED.some((r) => r.test(f)));

if (shouldBuild) {
    console.log('✓ Web-relevant changes detected — proceeding with build.');
    process.exit(1); // build
}

console.log('• No web changes — skipping Vercel build.');
process.exit(0); // skip
