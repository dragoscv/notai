#!/usr/bin/env node
/**
 * Pre-commit gate: if a `package.json` "version" was bumped in the staged
 * changes, require that CHANGELOG.md is also staged and that the new version
 * appears in it. Keeps the changelog honest without forcing edits on every
 * commit.
 *
 * Exits 0 when checks pass or no version bump was detected. Exits 1 with a
 * descriptive message otherwise.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function git(cmd) {
    return execSync(`git ${cmd}`, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

const stagedFiles = git('diff --cached --name-only --diff-filter=ACMR')
    .split('\n')
    .filter(Boolean);

const bumpedPackageJsons = stagedFiles.filter((f) => f.endsWith('package.json'));
if (bumpedPackageJsons.length === 0) process.exit(0);

const bumps = [];
for (const file of bumpedPackageJsons) {
    let stagedJson, headJson;
    try {
        stagedJson = JSON.parse(git(`show :${file}`));
    } catch {
        continue;
    }
    try {
        headJson = JSON.parse(git(`show HEAD:${file}`));
    } catch {
        // New file — count as a bump if it has a version
        if (stagedJson.version) bumps.push({ file, name: stagedJson.name, version: stagedJson.version });
        continue;
    }
    if (stagedJson.version && stagedJson.version !== headJson.version) {
        bumps.push({ file, name: stagedJson.name, version: stagedJson.version });
    }
}

if (bumps.length === 0) process.exit(0);

const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
if (!existsSync(changelogPath)) {
    console.error('✖ Version bump detected but CHANGELOG.md is missing. Create it before committing.');
    process.exit(1);
}

const changelogStaged = stagedFiles.includes('CHANGELOG.md');
const changelog = readFileSync(changelogPath, 'utf8');

const missing = [];
for (const { name, version } of bumps) {
    // Accept either an explicit `[version]` heading or any mention of the
    // version string within an Unreleased section that's about to be cut.
    const has = changelog.includes(`[${version}]`) || changelog.includes(version);
    if (!has) missing.push(`${name} → ${version}`);
}

if (missing.length > 0 || !changelogStaged) {
    console.error('');
    console.error('✖ Version bump requires a CHANGELOG.md update.');
    console.error('  Bumped:');
    for (const b of bumps) console.error(`    • ${b.name} → ${b.version}`);
    if (missing.length > 0) {
        console.error('  Missing entries:');
        for (const m of missing) console.error(`    • ${m}`);
    }
    if (!changelogStaged) {
        console.error('  CHANGELOG.md is not staged. `git add CHANGELOG.md` and try again.');
    }
    process.exit(1);
}

console.log(`✓ CHANGELOG.md covers ${bumps.length} version bump(s).`);
process.exit(0);
