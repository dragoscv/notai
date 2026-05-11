import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { addSuppression } from '@/server/email-suppressions';

export const runtime = 'nodejs';

/**
 * Resend webhook receiver. Resend signs payloads using the Svix scheme:
 *   svix-id, svix-timestamp, svix-signature: "v1,<base64-hmac>"
 * where the signed string is `${id}.${timestamp}.${rawBody}` HMAC-SHA256
 * with the secret bytes (the secret comes prefixed with `whsec_` and is
 * base64-encoded after the prefix).
 *
 * Configure: RESEND_WEBHOOK_SECRET=whsec_xxxxxxxx in the env, and point
 * the Resend dashboard endpoint at https://your-host/api/webhooks/resend
 * subscribed to email.bounced, email.complained, email.delivery_delayed.
 */

const TOLERANCE_S = 5 * 60;

interface ResendEvent {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    from?: string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
    complaint?: { feedbackType?: string; userAgent?: string };
  };
}

function verifySvix(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sig = headers.get('svix-signature');
  if (!id || !ts || !sig) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > TOLERANCE_S) return false;

  // Secret is `whsec_` + base64 key bytes.
  const b64 = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(b64, 'base64');
  } catch {
    return false;
  }

  const toSign = `${id}.${ts}.${rawBody}`;
  const expected = createHmac('sha256', keyBytes).update(toSign).digest('base64');

  // Header may carry multiple `v1,sig v1,sig2` space-separated entries.
  const presented = sig
    .split(' ')
    .map((s) => s.split(','))
    .filter((parts): parts is [string, string] => parts.length === 2 && parts[0] === 'v1')
    .map((parts) => parts[1]);
  if (presented.length === 0) return false;

  const expBuf = Buffer.from(expected);
  return presented.some((p) => {
    const pb = Buffer.from(p);
    return pb.length === expBuf.length && timingSafeEqual(pb, expBuf);
  });
}

function asArray(v: string[] | string | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook_disabled' }, { status: 503 });
  }

  const raw = await req.text();
  if (raw.length > 256 * 1024) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }
  if (!verifySvix(raw, req.headers, secret)) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  }

  let evt: ResendEvent;
  try {
    evt = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const recipients = asArray(evt.data?.to);
  if (recipients.length === 0) {
    // Nothing actionable; ack to stop retries.
    return NextResponse.json({ ok: true, ignored: 'no_recipient' });
  }

  switch (evt.type) {
    case 'email.bounced': {
      // Hard bounces only — soft bounces (mailbox full, greylisted)
      // shouldn't poison the suppression list permanently.
      const isHard =
        (evt.data?.bounce?.type ?? '').toLowerCase() === 'permanent' ||
        /hard|undeliverable|invalid/i.test(evt.data?.bounce?.subType ?? '');
      const reason = isHard ? 'bounce' : 'delivery_delayed';
      for (const to of recipients) {
        await addSuppression({
          email: to,
          reason,
          source: 'resend.bounced',
          detail: evt.data?.bounce?.message ?? evt.data?.bounce?.subType,
          payload: evt,
        });
      }
      break;
    }
    case 'email.complained': {
      for (const to of recipients) {
        await addSuppression({
          email: to,
          reason: 'complaint',
          source: 'resend.complained',
          detail: evt.data?.complaint?.feedbackType,
          payload: evt,
        });
      }
      break;
    }
    case 'email.delivery_delayed': {
      // Track but don't permanently suppress; useful for ops dashboards.
      for (const to of recipients) {
        await addSuppression({
          email: to,
          reason: 'delivery_delayed',
          source: 'resend.delayed',
          payload: evt,
        });
      }
      break;
    }
    default:
      // Unknown event types ack so Resend stops retrying.
      return NextResponse.json({ ok: true, ignored: evt.type ?? 'unknown' });
  }

  return NextResponse.json({ ok: true });
}
