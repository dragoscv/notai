import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { PushNotificationsToggle } from '@/components/settings/push-notifications-toggle';

export async function generateMetadata() {
  const t = await getTranslations('settings.pages.notifications');
  return { title: t('title') };
}

export default async function NotificationsPage() {
  const t = await getTranslations('settings.pages.notifications');
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/notifications');
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">{t('heading')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('intro')}</p>
      </div>
      <div className="bg-card rounded-2xl border p-6">
        <PushNotificationsToggle />
        <p className="text-muted-foreground mt-3 text-xs">{t('footer')}</p>
      </div>
    </div>
  );
}
