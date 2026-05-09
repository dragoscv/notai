'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  db,
  eq,
  and,
  desc,
  sql,
  count,
  supportTickets,
  supportTicketMessages,
  users,
} from '@notai/db';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/rate-limit';
import { requirePermission } from '@/server/rbac';
import { audit } from '@/server/audit';
import { notifyNewTicket } from '@/server/support-notify';
import { LEGAL } from '@/lib/legal-info';

const TICKET_CATEGORIES = [
  'general',
  'billing',
  'bug',
  'feature_request',
  'account',
  'gdpr',
  'other',
] as const;

const NewTicketSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  subject: z.string().min(3).max(160),
  body: z.string().min(10).max(8000),
  category: z.enum(TICKET_CATEGORIES).default('general'),
  // Honeypot
  website: z.string().max(0).optional().or(z.literal('')),
});

export type CreateTicketState =
  | { status: 'idle' }
  | { status: 'success'; reference: string }
  | {
      status: 'error';
      message?: string;
      fieldErrors?: Partial<Record<'name' | 'email' | 'subject' | 'body' | 'category', string>>;
    };

async function nextReference(): Promise<string> {
  // Format NT-YYYY-#### where #### is the count of tickets created this year
  // plus one. Cheap and human-friendly. Race-tolerant: a duplicate would just
  // mean two tickets share a reference for one millisecond, which is harmless.
  const year = new Date().getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const seq =
    (
      await db
        .select({ value: count() })
        .from(supportTickets)
        .where(sql`${supportTickets.createdAt} >= ${startOfYear}`)
    )[0]?.value ?? 0;
  return `NT-${year}-${String(seq + 1).padStart(4, '0')}`;
}

function ticketUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? LEGAL.url;
  return `${base.replace(/\/$/, '')}/admin/support/${id}`;
}

export async function createSupportTicket(
  _prev: CreateTicketState,
  formData: FormData,
): Promise<CreateTicketState> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
  const rl = await rateLimit({ name: 'support_create', key: ip, windowSec: 600, max: 5 });
  if (!rl.ok) {
    return { status: 'error', message: 'Too many requests. Please try again later.' };
  }

  const session = await auth();
  const viewer = session?.user;

  const parsed = NewTicketSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    subject: formData.get('subject'),
    body: formData.get('body'),
    category: formData.get('category') ?? 'general',
    website: formData.get('website'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { status: 'error', fieldErrors };
  }
  // Silently drop honeypot hits.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return { status: 'success', reference: 'NT-DROPPED' };
  }

  const reference = await nextReference();
  const inserted = await db
    .insert(supportTickets)
    .values({
      reference,
      userId: viewer?.id ?? null,
      email: parsed.data.email,
      name: parsed.data.name,
      subject: parsed.data.subject,
      category: parsed.data.category,
    })
    .returning({ id: supportTickets.id });

  const ticketId = inserted[0]?.id;
  if (!ticketId) return { status: 'error', message: 'Could not create ticket. Try again.' };

  await db.insert(supportTicketMessages).values({
    ticketId,
    authorId: viewer?.id ?? null,
    fromStaff: false,
    body: parsed.data.body,
  });

  await notifyNewTicket({
    reference,
    subject: parsed.data.subject,
    body: parsed.data.body,
    fromName: parsed.data.name,
    fromEmail: parsed.data.email,
    category: parsed.data.category,
    priority: 'normal',
    ticketUrl: ticketUrl(ticketId),
    isNew: true,
  });

  revalidatePath('/support');
  revalidatePath('/admin/support');
  return { status: 'success', reference };
}

const ReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1).max(8000),
});

export async function addUserReply(input: z.infer<typeof ReplySchema>): Promise<{ ok: true }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sign in required');

  const parsed = ReplySchema.parse(input);
  const ticket = await db.query.supportTickets.findFirst({
    where: and(eq(supportTickets.id, parsed.ticketId), eq(supportTickets.userId, session.user.id)),
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.status === 'closed') throw new Error('Ticket is closed');

  await db.insert(supportTicketMessages).values({
    ticketId: ticket.id,
    authorId: session.user.id,
    fromStaff: false,
    body: parsed.body,
  });
  await db
    .update(supportTickets)
    .set({ status: 'open', updatedAt: new Date() })
    .where(eq(supportTickets.id, ticket.id));

  await notifyNewTicket({
    reference: ticket.reference,
    subject: ticket.subject,
    body: parsed.body,
    fromName: ticket.name,
    fromEmail: ticket.email,
    category: ticket.category,
    priority: ticket.priority,
    ticketUrl: ticketUrl(ticket.id),
    isNew: false,
  });

  revalidatePath('/support');
  revalidatePath(`/support/${ticket.id}`);
  revalidatePath(`/admin/support/${ticket.id}`);
  return { ok: true };
}

export async function listMyTickets() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return db
    .select({
      id: supportTickets.id,
      reference: supportTickets.reference,
      subject: supportTickets.subject,
      status: supportTickets.status,
      priority: supportTickets.priority,
      category: supportTickets.category,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
    })
    .from(supportTickets)
    .where(eq(supportTickets.userId, session.user.id))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(100);
}

export async function getMyTicket(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const ticket = await db.query.supportTickets.findFirst({
    where: and(eq(supportTickets.id, id), eq(supportTickets.userId, session.user.id)),
  });
  if (!ticket) return null;
  const messages = await db
    .select()
    .from(supportTicketMessages)
    .where(and(eq(supportTicketMessages.ticketId, id), eq(supportTicketMessages.internal, false)))
    .orderBy(supportTicketMessages.createdAt);
  return { ticket, messages };
}

// ───────────────── Admin ─────────────────

export async function listAdminTickets(filters: {
  status?: 'all' | 'open' | 'pending' | 'resolved' | 'closed';
  q?: string;
  limit?: number;
  offset?: number;
}) {
  await requirePermission('support:read');
  const limit = Math.min(100, filters.limit ?? 50);
  const offset = Math.max(0, filters.offset ?? 0);

  const conds = [] as ReturnType<typeof sql>[];
  if (filters.status && filters.status !== 'all') {
    conds.push(sql`${supportTickets.status} = ${filters.status}`);
  }
  if (filters.q) {
    const pat = `%${filters.q}%`;
    conds.push(
      sql`(${supportTickets.subject} ILIKE ${pat} OR ${supportTickets.email} ILIKE ${pat} OR ${supportTickets.reference} ILIKE ${pat})`,
    );
  }
  const where = conds.length > 0 ? sql.join(conds, sql` AND `) : undefined;

  const rows = await db
    .select({
      id: supportTickets.id,
      reference: supportTickets.reference,
      subject: supportTickets.subject,
      status: supportTickets.status,
      priority: supportTickets.priority,
      category: supportTickets.category,
      email: supportTickets.email,
      name: supportTickets.name,
      userId: supportTickets.userId,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
    })
    .from(supportTickets)
    .where(where)
    .orderBy(desc(supportTickets.updatedAt))
    .limit(limit)
    .offset(offset);

  const totalRow = where
    ? await db.select({ value: count() }).from(supportTickets).where(where)
    : await db.select({ value: count() }).from(supportTickets);

  return { rows, total: totalRow[0]?.value ?? 0 };
}

export async function getAdminTicket(id: string) {
  await requirePermission('support:read');
  const ticket = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, id),
  });
  if (!ticket) return null;
  const messages = await db
    .select({
      id: supportTicketMessages.id,
      ticketId: supportTicketMessages.ticketId,
      authorId: supportTicketMessages.authorId,
      authorName: users.name,
      authorEmail: users.email,
      fromStaff: supportTicketMessages.fromStaff,
      internal: supportTicketMessages.internal,
      body: supportTicketMessages.body,
      createdAt: supportTicketMessages.createdAt,
    })
    .from(supportTicketMessages)
    .leftJoin(users, eq(users.id, supportTicketMessages.authorId))
    .where(eq(supportTicketMessages.ticketId, id))
    .orderBy(supportTicketMessages.createdAt);
  return { ticket, messages };
}

const AdminReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1).max(8000),
  internal: z.boolean().default(false),
  newStatus: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
});

export async function adminReplyTicket(input: z.infer<typeof AdminReplySchema>) {
  await requirePermission('support:reply');
  const session = await auth();
  const parsed = AdminReplySchema.parse(input);
  const ticket = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, parsed.ticketId),
  });
  if (!ticket) throw new Error('Ticket not found');

  await db.insert(supportTicketMessages).values({
    ticketId: ticket.id,
    authorId: session?.user?.id ?? null,
    fromStaff: true,
    internal: parsed.internal,
    body: parsed.body,
  });

  const nextStatus = parsed.newStatus ?? (parsed.internal ? ticket.status : 'pending');
  await db
    .update(supportTickets)
    .set({
      status: nextStatus,
      closedAt: nextStatus === 'closed' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, ticket.id));

  if (!parsed.internal) {
    // Email the requester their reply.
    try {
      const { sendEmail } = await import('@/server/email');
      await sendEmail({
        to: ticket.email,
        subject: `[${ticket.reference}] Re: ${ticket.subject}`,
        text: `${parsed.body}\n\n— Notai support`,
      });
    } catch (e) {
      console.error('[support.reply.email]', e);
    }
  }

  await audit({
    action: 'support.reply',
    resourceType: 'support_ticket',
    resourceId: ticket.id,
    metadata: {
      reference: ticket.reference,
      internal: parsed.internal,
      statusChange: parsed.newStatus ?? null,
    },
  });

  revalidatePath('/admin/support');
  revalidatePath(`/admin/support/${ticket.id}`);
  return { ok: true };
}

const TicketUpdateSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assigneeId: z.string().nullable().optional(),
});

export async function updateAdminTicket(input: z.infer<typeof TicketUpdateSchema>) {
  await requirePermission('support:manage');
  const parsed = TicketUpdateSchema.parse(input);
  const before = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, parsed.ticketId),
  });
  if (!before) throw new Error('Ticket not found');

  await db
    .update(supportTickets)
    .set({
      status: parsed.status ?? before.status,
      priority: parsed.priority ?? before.priority,
      assigneeId: parsed.assigneeId === undefined ? before.assigneeId : parsed.assigneeId,
      closedAt: parsed.status === 'closed' ? new Date() : parsed.status ? null : before.closedAt,
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, parsed.ticketId));

  await audit({
    action: 'support.update',
    resourceType: 'support_ticket',
    resourceId: parsed.ticketId,
    before: {
      status: before.status,
      priority: before.priority,
      assigneeId: before.assigneeId,
    },
    after: parsed,
  });

  revalidatePath('/admin/support');
  revalidatePath(`/admin/support/${parsed.ticketId}`);
  return { ok: true };
}
