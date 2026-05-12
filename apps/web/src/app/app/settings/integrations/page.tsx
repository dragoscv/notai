import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { listPersonalAccessTokens } from '@/server/actions/pat';
import { IntegrationsPanel } from './panel';

export async function generateMetadata() {
  const t = await getTranslations('settings.pages.integrations');
  return { title: t('title') };
}

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/integrations');
  const tokens = await listPersonalAccessTokens();
  return <IntegrationsPanel tokens={tokens} />;
}
