/**
 * Tiny Resend wrapper used by every server action that sends mail
 * (contact, sharing invites, billing receipts, …). Centralised so we
 * have one place that handles the dev fallback and the prod failure mode.
 */

interface SendInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
}: SendInput): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM ?? 'Notai <noreply@notai.ro>';

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[email] RESEND_API_KEY missing in production; refusing to send');
      return { ok: false };
    }
    console.info('[email] (dev) would send to %s — %s', maskEmail(to), subject);
    console.info('[email] (dev) text:\n%s', text);
    return { ok: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,
      reply_to: replyTo,
    }),
  });

  if (!res.ok) {
    console.error('[email] Resend error %d %s', res.status, await res.text());
    return { ok: false };
  }
  return { ok: true };
}

function maskEmail(s: string) {
  return s.replace(/^([^@]).*(@.*)$/, '$1…$2');
}
