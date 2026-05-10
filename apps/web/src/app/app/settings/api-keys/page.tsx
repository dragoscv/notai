import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listMyApiKeys } from '@/server/actions/api-keys';
import { ApiKeyManager } from '@/components/settings/api-key-manager';

export const metadata = { title: 'API keys \u2014 Notai' };
export const dynamic = 'force-dynamic';

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/api-keys');
  const keys = await listMyApiKeys();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">API keys</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Use these to call the public REST API at
          <code className="bg-muted ml-1 rounded px-1">/api/v1/notes</code>. Pass them as{' '}
          <code className="bg-muted rounded px-1">Authorization: Bearer nk_\u2026</code>. The full
          key is shown only once at creation.
        </p>
      </div>
      <ApiKeyManager
        initial={keys.map((k) => ({
          ...k,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          expiresAt: k.expiresAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
