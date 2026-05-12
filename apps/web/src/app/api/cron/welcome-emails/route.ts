import { NextRequest, NextResponse } from 'next/server';
import { db, users, emailLifecycleSends, sql, and, notInArray, isNotNull } from '@notai/db';
import { sendEmail } from '@/server/email';
import { makeUnsubscribeToken } from '@/server/unsubscribe-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notai.ro';

type Kind = 'welcome' | 'day-3-tip' | 'day-7-feedback';

const STAGES: { kind: Kind; daysAgo: number }[] = [
  { kind: 'welcome', daysAgo: 0 },
  { kind: 'day-3-tip', daysAgo: 3 },
  { kind: 'day-7-feedback', daysAgo: 7 },
];

async function handle(req: NextRequest) {
  const authorized =
    req.headers.get('x-vercel-cron') === '1' ||
    req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let totalSent = 0;
  let totalSkipped = 0;
  const perStage: Record<string, { sent: number; skipped: number }> = {};

  for (const stage of STAGES) {
    perStage[stage.kind] = { sent: 0, skipped: 0 };

    // Cohort window: users created between (now - daysAgo - 12h) and (now - daysAgo + 12h),
    // minus those who already received this stage. ±12h gives daily cron headroom.
    const alreadySent = db
      .select({ userId: emailLifecycleSends.userId })
      .from(emailLifecycleSends)
      .where(sql`${emailLifecycleSends.kind} = ${stage.kind}`);

    const cohort = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(
        and(
          isNotNull(users.email),
          sql`${users.createdAt} >= NOW() - INTERVAL '${sql.raw(String(stage.daysAgo))} days' - INTERVAL '12 hours'`,
          sql`${users.createdAt} <= NOW() - INTERVAL '${sql.raw(String(stage.daysAgo))} days' + INTERVAL '12 hours'`,
          notInArray(users.id, alreadySent),
        ),
      )
      .limit(500);

    for (const u of cohort) {
      if (!u.email) continue;
      const token = makeUnsubscribeToken(u.email);
      const message = renderMessage(stage.kind, { name: u.name ?? '', token });
      const result = await sendEmail({
        to: u.email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      if (result.ok) {
        await db
          .insert(emailLifecycleSends)
          .values({ userId: u.id, kind: stage.kind })
          .onConflictDoNothing();
        totalSent++;
        perStage[stage.kind]!.sent++;
      } else {
        totalSkipped++;
        perStage[stage.kind]!.skipped++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent: totalSent, skipped: totalSkipped, perStage });
}

interface RenderArgs {
  name: string;
  token: string;
}

function renderMessage(kind: Kind, a: RenderArgs): { subject: string; text: string; html: string } {
  const greeting = a.name ? `Hi ${a.name.split(' ')[0]},` : 'Hi,';
  const unsubUrl = `${BASE_URL}/unsubscribe?token=${encodeURIComponent(a.token)}`;
  const accountNotice = 'Account-related security and billing notifications may still be sent.';

  switch (kind) {
    case 'welcome': {
      const subject = 'Welcome to Notai';
      const text = [
        greeting,
        '',
        'Thanks for joining Notai — a calm, local-first place to think.',
        '',
        'A quick start:',
        `  · Open your notes: ${BASE_URL}/app`,
        `  · Read the 2-minute getting started: ${BASE_URL}/docs/getting-started`,
        `  · Capture a thought from anywhere with Cmd/Ctrl+Shift+N (desktop)`,
        '',
        'Reply to this email any time — I read every message.',
        '',
        '— Dragoș, Notai',
        '',
        '---',
        accountNotice,
        `Unsubscribe from product emails: ${unsubUrl}`,
      ].join('\n');
      const html = baseHtml({
        title: 'Welcome to Notai',
        body: `<p>${greeting}</p>
<p>Thanks for joining <strong>Notai</strong> — a calm, local-first place to think.</p>
<p><strong>A quick start:</strong></p>
<ul>
  <li><a href="${BASE_URL}/app">Open your notes</a></li>
  <li><a href="${BASE_URL}/docs/getting-started">Read the 2-minute getting started</a></li>
  <li>Capture a thought from anywhere with <code>Cmd/Ctrl+Shift+N</code> (desktop app)</li>
</ul>
<p>Reply to this email any time — I read every message.</p>
<p>— Dragoș, Notai</p>`,
        unsubUrl,
        accountNotice,
      });
      return { subject, text, html };
    }
    case 'day-3-tip': {
      const subject = 'A tiny tip for your second week';
      const text = [
        greeting,
        '',
        "Here's the one habit Notai users tell me actually sticks:",
        '',
        "Capture first, organise later. Don't name the note. Don't pick a folder.",
        'Just press Cmd/Ctrl+K, type, hit Enter. The search and graph view will',
        "find it again — that's their whole job.",
        '',
        `More keyboard shortcuts: ${BASE_URL}/docs/getting-started`,
        '',
        '— Dragoș',
        '',
        '---',
        accountNotice,
        `Unsubscribe from product emails: ${unsubUrl}`,
      ].join('\n');
      const html = baseHtml({
        title: 'A tiny tip for your second week',
        body: `<p>${greeting}</p>
<p>Here's the one habit Notai users tell me actually sticks:</p>
<p><strong>Capture first, organise later.</strong> Don't name the note. Don't pick a folder. Just press <code>Cmd/Ctrl+K</code>, type, hit Enter. Search and the graph view will find it again — that's their whole job.</p>
<p><a href="${BASE_URL}/docs/getting-started">More keyboard shortcuts →</a></p>
<p>— Dragoș</p>`,
        unsubUrl,
        accountNotice,
      });
      return { subject, text, html };
    }
    case 'day-7-feedback': {
      const subject = 'How is Notai working for you?';
      const text = [
        greeting,
        '',
        "You've been using Notai for a week — thank you.",
        '',
        "I'd love to hear one thing: what's the smallest change that would make",
        'Notai noticeably better for you? Even one sentence helps.',
        '',
        `  · Reply to this email`,
        `  · Or open a thread: ${BASE_URL}/support/new`,
        `  · See what's planned: ${BASE_URL}/roadmap`,
        '',
        '— Dragoș',
        '',
        '---',
        accountNotice,
        `Unsubscribe from product emails: ${unsubUrl}`,
      ].join('\n');
      const html = baseHtml({
        title: 'How is Notai working for you?',
        body: `<p>${greeting}</p>
<p>You've been using Notai for a week — thank you.</p>
<p>I'd love to hear one thing: <strong>what's the smallest change that would make Notai noticeably better for you?</strong> Even one sentence helps.</p>
<ul>
  <li>Reply to this email</li>
  <li><a href="${BASE_URL}/support/new">Open a support thread</a></li>
  <li><a href="${BASE_URL}/roadmap">See what's planned</a></li>
</ul>
<p>— Dragoș</p>`,
        unsubUrl,
        accountNotice,
      });
      return { subject, text, html };
    }
  }
}

function baseHtml(args: {
  title: string;
  body: string;
  unsubUrl: string;
  accountNotice: string;
}): string {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;line-height:1.55">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(args.title)}</h1>
${args.body}
<hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0 16px">
<p style="color:#888;font-size:12px;margin:0 0 8px">${escapeHtml(args.accountNotice)}</p>
<p style="color:#888;font-size:12px;margin:0"><a href="${args.unsubUrl}" style="color:#888">Unsubscribe from product emails</a></p>
</body></html>`;
}

function escapeHtml(s: string): string {
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
