import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getMyPlan } from '@/server/actions/billing';
import { BillingPanel } from './panel';

export const metadata = { title: 'Billing — Notai' };

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/billing');
  const plan = await getMyPlan();
  return <BillingPanel plan={plan} />;
}
