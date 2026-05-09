import { auth } from '@/auth';
import { getPublicPlans } from '@/server/public-plans';
import { PricingClient } from './client';

export const metadata = {
  title: 'Pricing — Notai',
  description:
    'Simple, transparent pricing. Free for personal use; Pro for power users; Teams for collaboration.',
};

export default async function PricingPage() {
  const [plans, session] = await Promise.all([getPublicPlans(), auth()]);
  return <PricingClient plans={plans} signedIn={!!session?.user?.id} />;
}
