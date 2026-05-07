// Build the realtime server: bundle workspace packages (@notai/*) inline,
// keep every other dependency external (so native + CJS deps like `ws` keep
// working at runtime via real node_modules).
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const externalDeps = Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith('@notai/'));

await build({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    external: externalDeps,
    logLevel: 'info',
});
