import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getMyPlan } from '@/server/actions/billing';
import { getQuotaState } from '@/server/plans';
import { BillingPanel } from './panel';
import { UsageSection } from './usage';

export const metadata = { title: 'Billing — Notai' };

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/billing');
  const [plan, quota] = await Promise.all([getMyPlan(), getQuotaState(session.user.id)]);
  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 px-6 py-10">
      <UsageSection
        tier={plan.tier}
        usage={{
          notes: quota.notes,
          attachments: quota.attachments,
          devices: quota.devices,
          ai: { ...quota.ai, periodStart: quota.ai.periodStart.toISOString() },
          history: quota.history,
        }}
      />
      <BillingPanel plan={plan} />
    </div>
  );
}
