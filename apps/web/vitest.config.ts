import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // We deliberately exclude server actions (they need a DB) — start
    // with pure-function coverage and grow from there.
    exclude: ['node_modules', '.next', 'src/server/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
