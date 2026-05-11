/**
 * Sentry — Browser runtime. Imported from `instrumentation-client.ts`.
 * Init is GATED behind analytics consent so that no Sentry replays /
 * traces leave the browser until the user opts in. Errors are still
 * captured by the framework's own boundaries (just not phoned home).
 */
import * as Sentry from '@sentry/nextjs';

const CONSENT_KEY = 'notai_consent';

function hasAnalyticsConsent(): boolean {
  if (typeof document === 'undefined') return false;
  const cookie = document.cookie.split('; ').find((r) => r.startsWith(`${CONSENT_KEY}=`));
  let raw: string | null = null;
  if (cookie) raw = decodeURIComponent(cookie.split('=')[1] ?? '');
  else {
    try {
      raw = window.localStorage.getItem(CONSENT_KEY);
    } catch {
      return false;
    }
  }
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { c?: { analytics?: boolean } };
    return !!parsed?.c?.analytics;
  } catch {
    return false;
  }
}

let started = false;
function start() {
  if (started) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  if (!hasAnalyticsConsent()) return;
  started = true;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration({ maskAllInputs: true })],
    ignoreErrors: ['ResizeObserver loop limit exceeded', 'Non-Error promise rejection'],
  });
}

start();
if (typeof window !== 'undefined') {
  window.addEventListener('notai:consent-changed', start as EventListener);
}
