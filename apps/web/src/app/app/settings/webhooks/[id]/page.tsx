import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { listMyWebhooks, listWebhookDeliveries } from '@/server/actions/webhooks';
import { WebhookDeliveriesPanel } from '@/components/settings/webhook-deliveries-panel';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  const t = await getTranslations('settings.pages.webhookDetail');
  return { title: t('title') };
}

export default async function WebhookDeliveriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations('settings.pages.webhookDetail');
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/webhooks');
  const { id } = await params;
  const all = await listMyWebhooks();
  const hook = all.find((h) => h.id === id);
  if (!hook) notFound();
  const deliveries = await listWebhookDeliveries(id);
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10">
      <Link
        href="/app/settings/webhooks"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-3.5" /> {t('allWebhooks')}
      </Link>
      <div>
        <h1 className="truncate text-2xl font-semibold">{hook.url}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {hook.events} · {hook.isActive ? t('active') : t('paused')} ·{' '}
          {hook.failureCount > 0
            ? hook.failureCount === 1
              ? t('failuresOne', { count: hook.failureCount })
              : t('failuresOther', { count: hook.failureCount })
            : t('healthy')}
        </p>
      </div>
      <WebhookDeliveriesPanel
        endpointId={id}
        initial={deliveries.map((d) => ({
          ...d,
          deliveredAt: d.deliveredAt.toISOString(),
        }))}
      />
    </div>
  );
}
