import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listMyTickets } from '@/server/actions/support';
import { LegalPage } from '@/components/layout/legal-page';
import { Badge } from '@notai/ui';
import { LEGAL } from '@/lib/legal-info';

export const metadata: Metadata = {
  title: 'My support tickets',
  alternates: { canonical: '/support' },
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  pending: 'Awaiting your reply',
  resolved: 'Resolved',
  closed: 'Closed',
};

export default async function SupportListPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?redirect=/support');

  const tickets = await listMyTickets();

  return (
    <LegalPage
      title="Support"
      subtitle="Open tickets, see past conversations, and get a reply by email."
      updated={LEGAL.lastUpdated}
    >
      <div className="not-prose mb-6 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
        </p>
        <Link
          href="/support/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition"
        >
          New ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="not-prose border-border/60 bg-card/40 rounded-xl border p-8 text-center">
          <p className="text-sm">You don&rsquo;t have any tickets yet.</p>
          <p className="text-muted-foreground mt-2 text-xs">
            Got a question?{' '}
            <Link className="underline" href="/support/new">
              Open a ticket
            </Link>{' '}
            or browse the{' '}
            <Link className="underline" href="/faq">
              FAQ
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="not-prose divide-border/60 border-border/60 divide-y rounded-xl border">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.id}`}
              className="hover:bg-muted/40 flex items-center justify-between gap-3 p-4 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="text-muted-foreground text-[10px]">{t.reference}</code>
                  <Badge variant="outline" className="text-[10px]">
                    {STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                </div>
                <div className="mt-1 truncate text-sm font-medium">{t.subject}</div>
              </div>
              <time className="text-muted-foreground text-xs" dateTime={t.updatedAt.toISOString()}>
                {new Date(t.updatedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </time>
            </Link>
          ))}
        </div>
      )}
    </LegalPage>
  );
}
