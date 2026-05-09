import { listAdminPlans } from '@/server/actions/admin';
import { PageHeader, Section } from '../_components/primitives';
import { PlansClient } from './client';

export const metadata = { title: 'Admin · Plans' };

export default async function AdminPlansPage() {
  const planRows = await listAdminPlans();
  return (
    <>
      <PageHeader
        title="Plans & pricing"
        description="Manage product plans, prices, and Stripe synchronization."
      />
      <Section>
        <PlansClient
          plans={planRows.map((p) => ({
            id: p.id,
            slug: p.slug,
            displayName: p.displayName,
            description: p.description,
            features: p.features as string[] | null,
            limits: p.limits as Record<string, number | null>,
            isActive: p.isActive,
            trialDays: p.trialDays,
            stripeProductId: p.stripeProductId,
            prices: p.prices.map((pr) => ({
              id: pr.id,
              currency: pr.currency,
              interval: pr.interval,
              unitAmount: pr.unitAmount,
              isActive: pr.isActive,
              stripePriceId: pr.stripePriceId,
            })),
          }))}
        />
      </Section>
    </>
  );
}
