import 'server-only';
import { db, eq, plans, planPrices, type Plan, type PlanPrice } from '@notai/db';
import { getStripe } from '@/server/stripe';

/**
 * Mirror our `plans` + `plan_prices` rows into Stripe.
 *
 * - Free plan is skipped (no Stripe Product needed).
 * - For each paid plan, ensure a Product exists; reuse via stored
 *   `stripeProductId`, otherwise create + store the new id.
 * - For each price row, Stripe prices are immutable, so:
 *     - if `stripePriceId` is set and amount/currency/interval still
 *       match, skip;
 *     - otherwise create a fresh Price, store its id, archive the old
 *       one (best-effort).
 *
 * Returns a per-plan summary the admin UI renders as a toast.
 *
 * Safe to run repeatedly — idempotent.
 */
export interface SyncResult {
  planSlug: string;
  productCreated: boolean;
  productUpdated: boolean;
  pricesCreated: number;
  pricesArchived: number;
  pricesSkipped: number;
  errors: string[];
}

export async function syncAllPlansToStripe(): Promise<SyncResult[]> {
  const allPlans = await db.query.plans.findMany();
  const out: SyncResult[] = [];
  for (const p of allPlans) {
    if (p.slug === 'free') continue;
    out.push(await syncPlanToStripe(p.id));
  }
  return out;
}

export async function syncPlanToStripe(planId: string): Promise<SyncResult> {
  const stripe = getStripe();
  const result: SyncResult = {
    planSlug: '',
    productCreated: false,
    productUpdated: false,
    pricesCreated: 0,
    pricesArchived: 0,
    pricesSkipped: 0,
    errors: [],
  };
  if (!stripe) {
    result.errors.push('Stripe not configured');
    return result;
  }

  const plan = await db.query.plans.findFirst({ where: eq(plans.id, planId) });
  if (!plan) {
    result.errors.push('Plan not found');
    return result;
  }
  result.planSlug = plan.slug;
  if (plan.slug === 'free') return result;

  // 1) Product
  const productId = await ensureProduct(plan, result);
  if (!productId) return result;

  // 2) Prices
  const prices = await db.query.planPrices.findMany({
    where: eq(planPrices.planId, plan.id),
  });
  for (const price of prices) {
    await ensurePrice(plan, productId, price, result);
  }

  return result;
}

async function ensureProduct(plan: Plan, result: SyncResult): Promise<string | null> {
  const stripe = getStripe()!;
  const desiredName = plan.displayName;
  const desiredDescription = plan.description ?? undefined;

  if (plan.stripeProductId) {
    try {
      const existing = await stripe.products.retrieve(plan.stripeProductId);
      if (existing.deleted) throw new Error('product was deleted');
      const needsUpdate =
        existing.name !== desiredName ||
        (desiredDescription !== undefined && existing.description !== desiredDescription) ||
        existing.active !== plan.isActive;
      if (needsUpdate) {
        await stripe.products.update(plan.stripeProductId, {
          name: desiredName,
          description: desiredDescription,
          active: plan.isActive,
        });
        result.productUpdated = true;
      }
      return plan.stripeProductId;
    } catch (err) {
      // fall through to recreate
      result.errors.push(
        `Product ${plan.stripeProductId} unreachable: ${(err as Error).message}; creating new`,
      );
    }
  }

  const created = await stripe.products.create({
    name: desiredName,
    description: desiredDescription,
    active: plan.isActive,
    metadata: { planId: plan.id, planSlug: plan.slug },
  });
  await db
    .update(plans)
    .set({ stripeProductId: created.id, updatedAt: new Date() })
    .where(eq(plans.id, plan.id));
  result.productCreated = true;
  return created.id;
}

async function ensurePrice(
  plan: Plan,
  productId: string,
  price: PlanPrice,
  result: SyncResult,
): Promise<void> {
  const stripe = getStripe()!;

  if (price.stripePriceId) {
    try {
      const existing = await stripe.prices.retrieve(price.stripePriceId);
      const matches =
        existing.unit_amount === price.unitAmount &&
        existing.currency === price.currency &&
        existing.recurring?.interval === price.interval &&
        existing.product === productId;
      if (matches && existing.active === price.isActive) {
        result.pricesSkipped += 1;
        return;
      }
      if (matches && existing.active !== price.isActive) {
        await stripe.prices.update(existing.id, { active: price.isActive });
        result.pricesSkipped += 1;
        return;
      }
      // Amount/currency/interval changed → create a new Price and archive old.
      try {
        await stripe.prices.update(existing.id, { active: false });
        result.pricesArchived += 1;
      } catch (err) {
        result.errors.push(`archive ${existing.id} failed: ${(err as Error).message}`);
      }
    } catch (err) {
      result.errors.push(
        `Price ${price.stripePriceId} unreachable: ${(err as Error).message}; creating new`,
      );
    }
  }

  const created = await stripe.prices.create({
    product: productId,
    unit_amount: price.unitAmount,
    currency: price.currency,
    recurring: { interval: price.interval },
    active: price.isActive,
    metadata: {
      planId: plan.id,
      planSlug: plan.slug,
      priceId: price.id,
      currency: price.currency,
      interval: price.interval,
    },
    nickname: `${plan.slug}-${price.currency}-${price.interval}`,
  });
  await db
    .update(planPrices)
    .set({ stripePriceId: created.id, updatedAt: new Date() })
    .where(eq(planPrices.id, price.id));
  result.pricesCreated += 1;
}
