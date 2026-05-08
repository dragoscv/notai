/**
 * Sentry — server-side runtime config (Next.js).
 *
 * Loaded automatically by `instrumentation.ts`. Disabled when SENTRY_DSN
 * is missing so dev/CI don't ship phantom events.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    environment: process.env.NODE_ENV,
    // Helps the dashboard tag releases when CI sets it.
    release: process.env.SENTRY_RELEASE,
  });
}
