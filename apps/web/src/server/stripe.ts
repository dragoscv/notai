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
  cached = new Stripe(key, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
    typescript: true,
    appInfo: { name: 'notai', version: '0.1.0' },
  });
  return cached;
}

export const PRICE_IDS = {
  proMonthly: env.STRIPE_PRICE_PRO_MONTHLY ?? '',
  proYearly: env.STRIPE_PRICE_PRO_YEARLY ?? '',
} as const;
