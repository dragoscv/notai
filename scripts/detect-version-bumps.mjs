#!/usr/bin/env node
/**
 * Detects which apps had their `version` field changed in a given git range
 * and prints a JSON line per app, e.g.
 *   {"web":true,"realtime":false,"desktop":true,"webVersion":"0.2.0","realtimeVersion":"0.1.0","desktopVersion":"0.2.0"}
 *
 * Used by GitHub Actions to decide whether to deploy / cut a release.
 *
 * Usage:
 *   node scripts/detect-version-bumps.mjs <baseSha> <headSha>
 * In CI the SHAs come from the push event payload (before/after).
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const [, , baseRaw, headRaw] = process.argv;
const base = baseRaw && baseRaw !== '0000000000000000000000000000000000000000' ? baseRaw : 'HEAD~1';
const head = headRaw || 'HEAD';

const APPS = {
    realtime: 'apps/realtime-server/package.json',
    desktop: 'apps/desktop/package.json',
};

function show(ref, file) {
    try {
        return execSync(`git show ${ref}:${file}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
        return null;
    }
}

const result = {};
for (const [key, file] of Object.entries(APPS)) {
    if (!existsSync(path.resolve(file))) {
        result[key] = false;
        result[`${key}Version`] = null;
        continue;
    }
    const headJson = JSON.parse(show(head, file) ?? readFileSync(file, 'utf8'));
    const baseJsonRaw = show(base, file);
    if (!baseJsonRaw) {
        // First time the file exists in the range — not a bump, just the
        // initial appearance. We never want to ship a release on bootstrap.
        result[key] = false;
        result[`${key}Version`] = headJson.version;
        continue;
    }
    const baseJson = JSON.parse(baseJsonRaw);
    result[key] = headJson.version !== baseJson.version;
    result[`${key}Version`] = headJson.version;
}

process.stdout.write(JSON.stringify(result));
