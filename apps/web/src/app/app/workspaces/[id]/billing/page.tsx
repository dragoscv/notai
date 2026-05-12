import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getWorkspaceBilling } from '@/server/actions/workspace-billing';
import { WorkspaceBillingPanel } from '@/components/workspace/workspace-billing-panel';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('pages.workspaces');
  return { title: t('billingMetaTitle') };
}

export default async function WorkspaceBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const { id } = await params;
  const [data, t] = await Promise.all([
    getWorkspaceBilling(id),
    getTranslations('pages.workspaces'),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('billingTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('billingDescription')}</p>
      </header>
      <WorkspaceBillingPanel workspaceId={id} initial={data} />
    </div>
  );
}
