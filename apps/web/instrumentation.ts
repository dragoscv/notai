/**
 * Next.js v16 server-side instrumentation hook. Loaded once per worker.
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// @sentry/nextjs v8 exports this as `captureRequestError`. Next.js expects
// the file convention name `onRequestError`, so we re-export under that name.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
