'use client';

import * as React from 'react';

/**
 * Privacy-first PostHog client. We don't pull in `posthog-js` to keep
 * the landing page bundle lean; instead we POST events to PostHog's
 * `/capture` endpoint directly. Loads only after the user accepts
 * analytics in the cookie banner (consent recorded in localStorage).
 *
 * Configure with:
 *   NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
 *   NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com  (or your region)
 *
 * If either env is missing this is a no-op \u2014 safe in dev.
 */

const STORAGE_KEY = 'notai:analytics-consent';
const ANON_KEY = 'notai:analytics-anon-id';

type Consent = 'accepted' | 'declined' | null;

function getConsent(): Consent {
  if (typeof window === 'undefined') return null;
  return (localStorage.getItem(STORAGE_KEY) as Consent) ?? null;
}

function getOrCreateAnonId(): string {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export function trackEvent(event: string, properties: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  if (getConsent() !== 'accepted') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
  if (!key) return;
  const distinct_id = getOrCreateAnonId();
  // Best-effort beacon \u2014 fire and forget.
  try {
    fetch(`${host}/capture/`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id,
        properties: {
          ...properties,
          $current_url: window.location.href,
          $referrer: document.referrer || undefined,
        },
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  } catch {
    /* swallow */
  }
}

/**
 * Bottom-of-screen consent banner. Renders once per user; the choice
 * is persisted in localStorage so we don't pester repeat visitors.
 * Auto-fires a `pageview` after acceptance.
 */
export function AnalyticsConsent() {
  const [consent, setConsent] = React.useState<Consent>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setConsent(getConsent());
  }, []);

  React.useEffect(() => {
    if (consent === 'accepted') {
      trackEvent('$pageview');
    }
  }, [consent]);

  if (!mounted) return null;
  if (consent !== null) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl">
      <div className="bg-card text-foreground flex flex-col gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center">
        <div className="text-sm">
          We use a privacy-first analytics tool to count anonymous visits. No cookies, no cross-site
          tracking.{' '}
          <a className="underline" href="/privacy-policy">
            Learn more
          </a>
          .
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(STORAGE_KEY, 'declined');
              setConsent('declined');
            }}
            className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-xs font-medium"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(STORAGE_KEY, 'accepted');
              setConsent('accepted');
            }}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
