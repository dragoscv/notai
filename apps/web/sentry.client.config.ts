/**
 * Sentry — Browser runtime. Imported from `instrumentation-client.ts`.
 * Capture rate is conservative; sessions only sampled at 1% to keep cost
 * sane while still catching weird editor crashes in the wild.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration({ maskAllInputs: true })],
    // Deny-list noisy framework warnings.
    ignoreErrors: ['ResizeObserver loop limit exceeded', 'Non-Error promise rejection'],
  });
}
