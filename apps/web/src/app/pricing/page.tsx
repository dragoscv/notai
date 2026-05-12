import { auth } from '@/auth';
import { getPublicPlans } from '@/server/public-plans';
import {
  AuroraBackground,
  MarketingFooter,
  MarketingHeader,
} from '@/components/marketing/site-shell';
import { PricingClient } from './client';

export const metadata = {
  title: 'Pricing — Notai',
  description:
    'Simple, transparent pricing. Free for personal use; Pro for power users; Teams for collaboration.',
};

export default async function PricingPage() {
  const [plans, session] = await Promise.all([getPublicPlans(), auth()]);
  return (
    <div className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <AuroraBackground />
      <MarketingHeader signedIn={!!session?.user?.id} />
      <main className="relative">
        <PricingClient plans={plans} signedIn={!!session?.user?.id} />
      </main>
      <MarketingFooter />
    </div>
  );
}
