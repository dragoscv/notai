// Next.js v16 client instrumentation hook (browser bundle entry).
// Imports are tree-shaken to nothing when SENTRY/POSTHOG envs are unset.
import './sentry.client.config';
import './src/lib/posthog-client';
