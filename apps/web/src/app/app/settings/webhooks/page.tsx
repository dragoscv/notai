import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listMyWebhooks } from '@/server/actions/webhooks';
import { WebhookManager } from '@/components/settings/webhook-manager';

export const metadata = { title: 'Webhooks \u2014 Notai' };
export const dynamic = 'force-dynamic';

export default async function WebhooksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/webhooks');
  const hooks = await listMyWebhooks();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Webhooks</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Receive a POST whenever you create, update, or archive a note via the REST API. Each
          request carries an
          <code className="bg-muted ml-1 rounded px-1">X-Notai-Signature: sha256=&hellip;</code>
          header (HMAC-SHA256 of the body using the per-endpoint secret).
        </p>
      </div>
      <WebhookManager
        initial={hooks.map((h) => ({
          ...h,
          createdAt: h.createdAt.toISOString(),
          lastSuccessAt: h.lastSuccessAt?.toISOString() ?? null,
          lastFailureAt: h.lastFailureAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
