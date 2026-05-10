import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PushNotificationsToggle } from '@/components/settings/push-notifications-toggle';

export const metadata = { title: 'Notifications \u2014 Notai' };

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/notifications');
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Browser push notifications keep daily reviews, mentions, and reminders in front of you
          even when Notai isn\u2019t the active tab.
        </p>
      </div>
      <div className="bg-card rounded-2xl border p-6">
        <PushNotificationsToggle />
        <p className="text-muted-foreground mt-3 text-xs">
          We only send actionable notifications: daily review prompts, @-mentions, and shared-note
          updates. Disable any time.
        </p>
      </div>
    </div>
  );
}
