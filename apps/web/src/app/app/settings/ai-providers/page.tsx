import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getProviderStatus } from '@/server/actions/ai-providers';
import { AiProvidersPanel } from './panel';

export const metadata = { title: 'AI providers — Notai' };

export default async function AiProvidersPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin?callbackUrl=/app/settings/ai-providers');
  }
  const status = await getProviderStatus();
  return <AiProvidersPanel initialStatus={status} />;
}
