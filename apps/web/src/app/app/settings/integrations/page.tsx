import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listPersonalAccessTokens } from '@/server/actions/pat';
import { IntegrationsPanel } from './panel';

export const metadata = { title: 'Integrations — Notai' };

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/integrations');
  const tokens = await listPersonalAccessTokens();
  return <IntegrationsPanel tokens={tokens} />;
}
