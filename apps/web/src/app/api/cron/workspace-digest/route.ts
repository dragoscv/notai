import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  workspaces,
  workspaceMembers,
  users,
  notes,
  noteComments,
  eq,
  and,
  inArray,
  sql,
} from '@notai/db';
import { sendEmail } from '@/server/email';

/**
 * Weekly workspace digest. Cron entry runs Monday 08:00 UTC. For every
 * workspace member we compose a single email summarising last 7 days
 * of activity in that workspace: notes added, notes updated, comments.
 *
 * Activity is bucketed per-workspace because most users belong to 1
 * workspace; sending one email per workspace per user keeps the
 * subject-line useful (`This week in <workspace>`).
 *
 * Auth: x-vercel-cron header OR Bearer ${CRON_SECRET}. Rejects otherwise.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const authorized =
    req.headers.get('x-vercel-cron') === '1' ||
    req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const since = sql`NOW() - INTERVAL '7 days'`;
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://notai.app';

  const wsRows = await db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces);
  if (wsRows.length === 0) return NextResponse.json({ ok: true, sent: 0, workspaces: 0 });

  let sent = 0;
  let skipped = 0;

  for (const ws of wsRows) {
    const memberRows = await db
      .select({
        userId: workspaceMembers.userId,
        email: users.email,
        name: users.name,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, ws.id));
    if (memberRows.length === 0) continue;

    const memberIds = memberRows.map((m) => m.userId);

    const newNoteRows = await db
      .select({
        id: notes.id,
        title: notes.title,
        ownerId: notes.ownerId,
      })
      .from(notes)
      .where(
        and(
          inArray(notes.ownerId, memberIds),
          sql`${notes.createdAt} >= ${since}`,
          sql`${notes.deletedAt} is null`,
        ),
      )
      .limit(20);

    const updatedRows = await db
      .select({
        id: notes.id,
        title: notes.title,
      })
      .from(notes)
      .where(
        and(
          inArray(notes.ownerId, memberIds),
          sql`${notes.updatedAt} >= ${since}`,
          sql`${notes.createdAt} < ${since}`,
          sql`${notes.deletedAt} is null`,
        ),
      )
      .limit(20);

    const [commentRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(noteComments)
      .where(
        and(inArray(noteComments.userId, memberIds), sql`${noteComments.createdAt} >= ${since}`),
      );
    const commentCount = commentRow?.count ?? 0;

    if (newNoteRows.length === 0 && updatedRows.length === 0 && commentCount === 0) {
      skipped += memberRows.length;
      continue;
    }

    const subject = `This week in ${ws.name}`;
    const text = renderText({
      workspace: ws.name,
      newNotes: newNoteRows,
      updated: updatedRows,
      comments: commentCount,
      baseUrl,
    });
    const html = renderHtml({
      workspace: ws.name,
      newNotes: newNoteRows,
      updated: updatedRows,
      comments: commentCount,
      baseUrl,
    });

    for (const member of memberRows) {
      if (!member.email) continue;
      const result = await sendEmail({ to: member.email, subject, text, html });
      if (result.ok) sent++;
      else skipped++;
    }
  }

  return NextResponse.json({ ok: true, workspaces: wsRows.length, sent, skipped });
}

interface DigestArgs {
  workspace: string;
  newNotes: { id: string; title: string }[];
  updated: { id: string; title: string }[];
  comments: number;
  baseUrl: string;
}

function renderText(a: DigestArgs): string {
  const lines: string[] = [];
  lines.push(`This week in ${a.workspace}`);
  lines.push('');
  lines.push(`New notes: ${a.newNotes.length}`);
  for (const n of a.newNotes.slice(0, 10)) {
    lines.push(`  · ${n.title || 'Untitled'} — ${a.baseUrl}/app/n/${n.id}`);
  }
  lines.push('');
  lines.push(`Updated notes: ${a.updated.length}`);
  for (const n of a.updated.slice(0, 10)) {
    lines.push(`  · ${n.title || 'Untitled'} — ${a.baseUrl}/app/n/${n.id}`);
  }
  lines.push('');
  lines.push(`Comments added: ${a.comments}`);
  return lines.join('\n');
}

function renderHtml(a: DigestArgs): string {
  const item = (n: { id: string; title: string }) =>
    `<li><a href="${a.baseUrl}/app/n/${n.id}">${escape(n.title || 'Untitled')}</a></li>`;
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
<h1 style="font-size:20px">This week in ${escape(a.workspace)}</h1>
<p style="color:#555">A quick recap of the last 7 days.</p>
<h2 style="font-size:14px;margin-top:24px">New notes (${a.newNotes.length})</h2>
<ul>${a.newNotes.slice(0, 10).map(item).join('') || '<li style="color:#888">None</li>'}</ul>
<h2 style="font-size:14px;margin-top:24px">Updated notes (${a.updated.length})</h2>
<ul>${a.updated.slice(0, 10).map(item).join('') || '<li style="color:#888">None</li>'}</ul>
<h2 style="font-size:14px;margin-top:24px">Comments added: ${a.comments}</h2>
<p style="color:#888;font-size:12px;margin-top:32px">You're receiving this because you're a member of ${escape(a.workspace)} on Notai.</p>
</body></html>`;
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
