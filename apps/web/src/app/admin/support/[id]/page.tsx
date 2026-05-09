import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAdminTicket } from '@/server/actions/support';
import { PageHeader, Section } from '../../_components/primitives';
import { Badge } from '@notai/ui';
import { TicketActions } from './ticket-actions';
import { ReplyComposer } from './reply-composer';

export const metadata = { title: 'Admin · Ticket' };

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAdminTicket(id);
  if (!result) notFound();
  const { ticket, messages } = result;

  return (
    <>
      <Link
        href="/admin/support"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-xs transition"
      >
        <ArrowLeft className="size-3.5" /> Back to all tickets
      </Link>

      <PageHeader
        title={ticket.subject}
        description={`${ticket.reference} · from ${ticket.name} (${ticket.email}) · opened ${new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{STATUS_LABEL[ticket.status]}</Badge>
            <Badge variant="outline" className="text-[10px]">
              {ticket.priority}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {ticket.category}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Section>
          <div className="space-y-3 p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  'rounded-xl border p-4 ' +
                  (m.internal
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : m.fromStaff
                      ? 'border-primary/20 bg-primary/5'
                      : 'border-border/60 bg-card/40')
                }
              >
                <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">
                      {m.fromStaff
                        ? `${m.authorName ?? 'Staff'}${m.internal ? ' · internal note' : ''}`
                        : ticket.name}
                    </span>
                    {m.fromStaff && m.authorEmail ? (
                      <code className="text-[10px]">{m.authorEmail}</code>
                    ) : null}
                  </div>
                  <time dateTime={m.createdAt.toISOString()}>
                    {new Date(m.createdAt).toLocaleString('en-GB')}
                  </time>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
              </div>
            ))}
          </div>

          <div className="border-t p-4">
            <ReplyComposer ticketId={ticket.id} />
          </div>
        </Section>

        <Section title="Properties">
          <div className="space-y-4 p-4">
            <TicketActions ticketId={ticket.id} status={ticket.status} priority={ticket.priority} />
            <div>
              <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                Requester
              </div>
              <div className="mt-1 text-sm">{ticket.name}</div>
              <a
                href={`mailto:${ticket.email}`}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                {ticket.email}
              </a>
              {ticket.userId ? (
                <Link
                  href={`/admin/users/${ticket.userId}`}
                  className="text-primary mt-1 block text-xs"
                >
                  View account →
                </Link>
              ) : (
                <p className="text-muted-foreground mt-1 text-xs">Submitted while signed out.</p>
              )}
            </div>
            <div>
              <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                Created
              </div>
              <div className="mt-1 text-xs">
                {new Date(ticket.createdAt).toLocaleString('en-GB')}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                Updated
              </div>
              <div className="mt-1 text-xs">
                {new Date(ticket.updatedAt).toLocaleString('en-GB')}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
