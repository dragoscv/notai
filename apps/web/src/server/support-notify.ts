/**
 * Notification fan-out for support tickets.
 *
 * Three optional channels:
 *   1. Email -> SUPPORT_INBOX (defaults to LEGAL.emails.support).
 *   2. Slack incoming webhook  (env SUPPORT_SLACK_WEBHOOK).
 *   3. Discord incoming webhook (env SUPPORT_DISCORD_WEBHOOK).
 *
 * All channels are best-effort: failures are logged but never thrown,
 * so a webhook outage cannot block ticket creation.
 */

import { sendEmail } from '@/server/email';
import { LEGAL } from '@/lib/legal-info';

interface NotifyArgs {
  reference: string;
  subject: string;
  body: string;
  fromName: string;
  fromEmail: string;
  category: string;
  priority: string;
  ticketUrl: string;
  /** True for new tickets; false for new replies. */
  isNew: boolean;
}

export async function notifyNewTicket(args: NotifyArgs): Promise<void> {
  await Promise.allSettled([emailNotify(args), slackNotify(args), discordNotify(args)]);
}

async function emailNotify(args: NotifyArgs) {
  const to = process.env.SUPPORT_INBOX ?? LEGAL.emails.support;
  const subject = `[${args.reference}] ${args.isNew ? 'New ticket' : 'New reply'}: ${args.subject}`;
  const text = [
    `Ticket: ${args.reference}`,
    `From: ${args.fromName} <${args.fromEmail}>`,
    `Category: ${args.category}  ·  Priority: ${args.priority}`,
    `Open: ${args.ticketUrl}`,
    '',
    args.body,
  ].join('\n');
  try {
    await sendEmail({ to, subject, text, replyTo: args.fromEmail });
  } catch (e) {
    console.error('[support.notify.email]', e);
  }
}

async function slackNotify(args: NotifyArgs) {
  const url = process.env.SUPPORT_SLACK_WEBHOOK;
  if (!url) return;
  const payload = {
    text: `*${args.reference}* — ${args.isNew ? 'New ticket' : 'New reply'}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${args.isNew ? '🆕' : '💬'} ${args.subject}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*From:*\n${args.fromName}\n${args.fromEmail}` },
          { type: 'mrkdwn', text: `*Ref:*\n${args.reference}` },
          { type: 'mrkdwn', text: `*Category:*\n${args.category}` },
          { type: 'mrkdwn', text: `*Priority:*\n${args.priority}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: truncate(args.body, 800) },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open ticket' },
            url: args.ticketUrl,
          },
        ],
      },
    ],
  };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[support.notify.slack]', e);
  }
}

async function discordNotify(args: NotifyArgs) {
  const url = process.env.SUPPORT_DISCORD_WEBHOOK;
  if (!url) return;
  const colors: Record<string, number> = {
    urgent: 0xef4444,
    high: 0xf59e0b,
    normal: 0x3b82f6,
    low: 0x6b7280,
  };
  const payload = {
    username: 'Notai support',
    embeds: [
      {
        title: `${args.isNew ? '🆕' : '💬'} ${args.subject}`,
        url: args.ticketUrl,
        description: truncate(args.body, 1500),
        color: colors[args.priority] ?? colors.normal,
        fields: [
          { name: 'From', value: `${args.fromName}\n${args.fromEmail}`, inline: true },
          { name: 'Ref', value: args.reference, inline: true },
          { name: 'Category', value: args.category, inline: true },
          { name: 'Priority', value: args.priority, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[support.notify.discord]', e);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
