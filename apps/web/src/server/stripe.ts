import 'server-only';
import Stripe from 'stripe';
import { env } from '@notai/lib';

let cached: Stripe | null = null;

/**
 * Lazy-initialised Stripe client. Returns null if the key is missing
 * (preview deployments, dev without billing) so call sites can degrade
 * gracefully instead of crashing the server.
 */
export function getStripe(): Stripe | null {
  if (cached) return cached;
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Loud, one-time warning if a test key leaks into production. Doesn't
  // crash \u2014 some deploys (e.g. preview) intentionally keep the test key.
  if (process.env.NODE_ENV === 'production' && key.startsWith('sk_test_') && !warnedTestKey) {
    warnedTestKey = true;
    console.warn(
      '[stripe] WARNING: production deployment is using a TEST mode key (sk_test_*). Customer charges will fail silently in the dashboard.',
    );
  }
  cached = new Stripe(key, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
    typescript: true,
    appInfo: { name: 'notai', version: '0.1.0' },
  });
  return cached;
}

let warnedTestKey = false;

export const PRICE_IDS = {
  proMonthly: env.STRIPE_PRICE_PRO_MONTHLY ?? '',
  proYearly: env.STRIPE_PRICE_PRO_YEARLY ?? '',
} as const;
