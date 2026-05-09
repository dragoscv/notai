import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getMyTicket } from '@/server/actions/support';
import { LegalPage } from '@/components/layout/legal-page';
import { Badge } from '@notai/ui';
import { LEGAL } from '@/lib/legal-info';
import { UserReplyForm } from './reply-form';

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  pending: 'Awaiting your reply',
  resolved: 'Resolved',
  closed: 'Closed',
};

export default async function MyTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?redirect=/support');
  const { id } = await params;
  const result = await getMyTicket(id);
  if (!result) notFound();
  const { ticket, messages } = result;

  return (
    <LegalPage
      title={ticket.subject}
      subtitle={`Ticket ${ticket.reference} · opened ${new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
      updated={LEGAL.lastUpdated}
    >
      <div className="not-prose mb-6 flex items-center gap-2">
        <Badge variant="outline">{STATUS_LABEL[ticket.status] ?? ticket.status}</Badge>
        <Badge variant="outline" className="text-[10px]">
          {ticket.category}
        </Badge>
      </div>

      <div className="not-prose space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              'border-border/60 rounded-xl border p-4 ' +
              (m.fromStaff ? 'bg-primary/5 border-primary/20' : 'bg-card/40')
            }
          >
            <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium">{m.fromStaff ? 'Notai support' : ticket.name}</span>
              <time dateTime={m.createdAt.toISOString()}>
                {new Date(m.createdAt).toLocaleString('en-GB')}
              </time>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== 'closed' ? (
        <>
          <h2>Reply</h2>
          <UserReplyForm ticketId={ticket.id} />
        </>
      ) : (
        <p className="text-muted-foreground mt-6 text-sm">
          This ticket is closed.{' '}
          <Link className="underline" href="/support/new">
            Open a new one
          </Link>{' '}
          if you need anything else.
        </p>
      )}
    </LegalPage>
  );
}
