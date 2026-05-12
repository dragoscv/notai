'use client';

import { toast } from 'sonner';

/**
 * Map a thrown server-action error to a user-friendly toast.
 *
 * Server actions that hit `requireQuota('ai', \u2026)` can throw four
 * distinct error shapes:
 *   - `QuotaExceededError`   \u2192 user is out of monthly AI calls (Pro upgrade)
 *   - `RateLimitError`       \u2192 too many calls in 60s (slow down)
 *   - `PRO_REQUIRED`         \u2192 feature requires Pro
 *   - any other Error        \u2192 generic
 *
 * Next.js 16 masks unhandled server-action errors to a digest in
 * production, but \u2014 critically \u2014 the *message* is still passed
 * through for errors thrown by user code (only the stack is stripped).
 * This util pattern-matches that message and surfaces actionable copy
 * with an "Upgrade" link where appropriate.
 */
export function showAiActionError(err: unknown, fallback = 'Something went wrong'): void {
  const msg = err instanceof Error ? err.message : String(err ?? '');

  if (/^Quota exceeded:\s*ai\s*\(/i.test(msg)) {
    toast.error('You\u2019re out of AI actions for this month.', {
      action: {
        label: 'Upgrade',
        onClick: () => {
          window.location.href = '/app/settings/billing';
        },
      },
      duration: 8000,
    });
    return;
  }

  if (/Rate limit exceeded\. Try again in (\d+)s/i.test(msg)) {
    const m = /Rate limit exceeded\. Try again in (\d+)s/i.exec(msg);
    const sec = m ? m[1] : '60';
    toast.warning(`Slow down \u2014 try again in ${sec}s.`);
    return;
  }

  if (msg === 'PRO_REQUIRED' || /requires? Pro/i.test(msg)) {
    toast.error('This feature requires a Pro subscription.', {
      action: {
        label: 'Upgrade',
        onClick: () => {
          window.location.href = '/app/settings/billing';
        },
      },
    });
    return;
  }

  if (/Not signed in/i.test(msg)) {
    toast.error('Your session expired. Please sign in again.', {
      action: {
        label: 'Sign in',
        onClick: () => {
          window.location.href = '/signin';
        },
      },
    });
    return;
  }

  // Production-mode digest masking: Next replaces user-thrown error
  // messages with a generic string. Detect and show the fallback.
  if (/An error occurred in the (Server Action|server)/i.test(msg)) {
    toast.error(fallback);
    return;
  }

  toast.error(msg || fallback);
}
