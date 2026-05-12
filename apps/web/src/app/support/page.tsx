import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listMyTickets } from '@/server/actions/support';
import { LegalPage } from '@/components/layout/legal-page';
import { Badge } from '@notai/ui';
import { LEGAL } from '@/lib/legal-info';
import { resolveLocale } from '../../../i18n';

export const metadata: Metadata = {
  title: 'My support tickets',
  alternates: { canonical: '/support' },
  robots: { index: false, follow: false },
};

const STATUS_LABEL_EN: Record<string, string> = {
  open: 'Open',
  pending: 'Awaiting your reply',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_LABEL_RO: Record<string, string> = {
  open: 'Deschis',
  pending: 'Așteaptă răspunsul tău',
  resolved: 'Rezolvat',
  closed: 'Închis',
};

export default async function SupportListPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?redirect=/support');

  const [tickets, locale] = await Promise.all([listMyTickets(), resolveLocale()]);
  const isRo = locale === 'ro';
  const statusLabel = isRo ? STATUS_LABEL_RO : STATUS_LABEL_EN;

  return (
    <LegalPage
      title={isRo ? 'Suport' : 'Support'}
      subtitle={
        isRo
          ? 'Deschide tichete, vezi conversațiile anterioare și primește un răspuns pe email.'
          : 'Open tickets, see past conversations, and get a reply by email.'
      }
      updated={LEGAL.lastUpdated}
    >
      <div className="not-prose mb-6 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {isRo
            ? `${tickets.length} ${tickets.length === 1 ? 'tichet' : 'tichete'}`
            : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`}
        </p>
        <Link
          href="/support/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition"
        >
          {isRo ? 'Tichet nou' : 'New ticket'}
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="not-prose border-border/60 bg-card/40 rounded-xl border p-8 text-center">
          <p className="text-sm">
            {isRo ? 'Încă nu ai niciun tichet.' : 'You don\u2019t have any tickets yet.'}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            {isRo ? (
              <>
                Ai o întrebare?{' '}
                <Link className="underline" href="/support/new">
                  Deschide un tichet
                </Link>{' '}
                sau răsfoiește{' '}
                <Link className="underline" href="/faq">
                  întrebările frecvente
                </Link>
                .
              </>
            ) : (
              <>
                Got a question?{' '}
                <Link className="underline" href="/support/new">
                  Open a ticket
                </Link>{' '}
                or browse the{' '}
                <Link className="underline" href="/faq">
                  FAQ
                </Link>
                .
              </>
            )}
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
                    {statusLabel[t.status] ?? t.status}
                  </Badge>
                </div>
                <div className="mt-1 truncate text-sm font-medium">{t.subject}</div>
              </div>
              <time className="text-muted-foreground text-xs" dateTime={t.updatedAt.toISOString()}>
                {new Date(t.updatedAt).toLocaleDateString(isRo ? 'ro-RO' : 'en-GB', {
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
