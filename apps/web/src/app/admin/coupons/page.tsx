import { listCoupons } from '@/server/actions/admin';
import { PageHeader, Section } from '../_components/primitives';
import { CouponsClient } from './client';

export const metadata = { title: 'Admin · Coupons' };

type CouponRow = Awaited<ReturnType<typeof listCoupons>>[number];

export default async function AdminCouponsPage() {
  let coupons: CouponRow[] = [];
  let stripeError: string | null = null;
  try {
    coupons = await listCoupons();
  } catch (e) {
    stripeError = e instanceof Error ? e.message : 'Failed to load coupons';
  }
  return (
    <>
      <PageHeader
        title="Coupons"
        description="Promo codes managed in Stripe — used at checkout for discounts."
      />
      <Section>
        {stripeError ? (
          <div className="text-muted-foreground border-b p-4 text-sm">
            Stripe not available: {stripeError}
          </div>
        ) : null}
        <CouponsClient
          coupons={coupons.map((c) => ({
            ...c,
            redeemBy: c.redeemBy ? c.redeemBy.toISOString() : null,
          }))}
        />
      </Section>
    </>
  );
}
