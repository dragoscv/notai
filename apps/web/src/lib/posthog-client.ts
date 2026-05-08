/**
 * PostHog browser client. Initialised once on first import; safe no-op
 * when NEXT_PUBLIC_POSTHOG_KEY is missing. We send pageviews ourselves
 * (cleaner with App Router) and flush events on visibility change.
 */
'use client';

import posthog from 'posthog-js';

declare global {
  interface Window {
    __notaiPosthogReady?: boolean;
  }
}

if (typeof window !== 'undefined' && !window.__notaiPosthogReady) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
  if (key) {
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
}

export { posthog };
