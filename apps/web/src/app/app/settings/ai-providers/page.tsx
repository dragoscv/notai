import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getProviderStatus } from '@/server/actions/ai-providers';
import { AiProvidersPanel } from './panel';

export async function generateMetadata() {
  const t = await getTranslations('settings.pages.aiProviders');
  return { title: t('title') };
}

export default async function AiProvidersPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin?callbackUrl=/app/settings/ai-providers');
  }
  const status = await getProviderStatus();
  return <AiProvidersPanel initialStatus={status} />;
}
