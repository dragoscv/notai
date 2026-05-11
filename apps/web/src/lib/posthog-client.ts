/**
 * PostHog browser client. Init is GATED behind analytics consent
 * (`notai_consent` cookie / localStorage; see ConsentProvider). The
 * module is safe to import at any time — it will only call `init()` once
 * the user has granted analytics consent, and re-listens for consent
 * changes.
 */
'use client';

import posthog from 'posthog-js';

declare global {
  interface Window {
    __notaiPosthogReady?: boolean;
  }
}

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

function tryInit() {
  if (typeof window === 'undefined' || window.__notaiPosthogReady) return;
  if (!hasAnalyticsConsent()) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
  if (!key) return;
  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    autocapture: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only',
  });
  window.__notaiPosthogReady = true;
}

if (typeof window !== 'undefined') {
  tryInit();
  window.addEventListener('notai:consent-changed', tryInit as EventListener);
}

export { posthog };
