import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { CalendarClient } from '@/components/calendar/calendar-client';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/calendar');
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground text-sm">
          See when you wrote what. Click a day to jump back.
        </p>
      </div>
      <CalendarClient />
    </div>
  );
}
