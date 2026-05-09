import 'server-only';
import { db } from '@notai/db';

export interface PublicPlan {
  slug: 'free' | 'pro' | 'teams';
  displayName: string;
  description: string | null;
  features: string[];
  limits: Record<string, number | null>;
  trialDays: number;
  prices: Array<{
    currency: 'eur' | 'usd' | 'ron';
    interval: 'month' | 'year';
    unitAmount: number;
  }>;
}

/**
 * Fetches all active plans + their active prices for the public pricing
 * page. Sorted by `sortOrder`, free first.
 */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  const planRows = await db.query.plans.findMany({
    where: (p, { eq }) => eq(p.isActive, true),
    orderBy: (p, { asc }) => [asc(p.sortOrder)],
  });
  const priceRows = await db.query.planPrices.findMany({
    where: (pr, { eq }) => eq(pr.isActive, true),
  });
  return planRows.map((p) => ({
    slug: p.slug,
    displayName: p.displayName,
    description: p.description,
    features: (p.features as string[]) ?? [],
    limits: (p.limits as Record<string, number | null>) ?? {},
    trialDays: p.trialDays,
    prices: priceRows
      .filter((pr) => pr.planId === p.id)
      .map((pr) => ({
        currency: pr.currency,
        interval: pr.interval,
        unitAmount: pr.unitAmount,
      })),
  }));
}
