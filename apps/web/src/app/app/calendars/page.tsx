import { CalendarsManager } from '@/components/settings/calendars-manager';
import { listCalendarSubscriptions } from '@/server/actions/calendar-subs';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const metadata = { title: 'Calendars' };

export default async function CalendarsPage() {
  const subs = await listCalendarSubscriptions();
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/app"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Calendars</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Subscribe to a calendar via its public iCal/webcal URL. Events from the next 7 days will
        show on your dashboard. Read-only — Notai never writes back to the calendar source.
      </p>
      <div className="mt-6">
        <CalendarsManager initial={subs} />
      </div>
      <details className="text-muted-foreground mt-8 text-xs">
        <summary className="cursor-pointer">Where do I find the iCal URL?</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <strong>Google Calendar</strong>: Settings → your calendar → &quot;Secret address in
            iCal format&quot;. Treat the URL as a password.
          </li>
          <li>
            <strong>Outlook</strong>: Settings → Calendar → Shared calendars → Publish a calendar →
            ICS link.
          </li>
          <li>
            <strong>Apple iCloud</strong>: Right-click a calendar → Share → Public Calendar → copy
            URL (replace <code>webcal://</code> with <code>https://</code>).
          </li>
        </ul>
      </details>
    </div>
  );
}
