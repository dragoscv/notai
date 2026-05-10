import { NextRequest, NextResponse } from 'next/server';
import { db, emailAliases, users, notes, assets, eq } from '@notai/db';
import { timingSafeEqual } from 'node:crypto';
import { buildKey, isAssetsConfigured, presign, publicUrlFor } from '@/server/storage/s3';

/**
 * Inbound email webhook (Postmark-shaped payload). Provision an
 * inbound stream in Postmark with this URL and set
 *   EMAIL_INBOUND_WEBHOOK_SECRET  → shared bearer token
 *   EMAIL_INBOUND_DOMAIN          → e.g. "in.notai.app"
 *
 * Security:
 *   - Bearer-token check (constant-time compare) on every request.
 *   - Routing token comes from the +tag part of the To address; the
 *     token is opaque so unknown senders can't write into a user's
 *     account.
 *   - From email MUST match the user's account email — Postmark
 *     populates `FromFull.Email` from the validated header, so this
 *     blocks trivial spoofing without DKIM checks here.
 */

interface PostmarkAddress {
  Email?: string;
  Name?: string;
  MailboxHash?: string;
}

interface PostmarkAttachment {
  Name?: string;
  Content?: string; // base64
  ContentType?: string;
  ContentLength?: number;
}

interface PostmarkInbound {
  FromFull?: PostmarkAddress;
  From?: string;
  ToFull?: PostmarkAddress[];
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  MessageID?: string;
  OriginalRecipient?: string;
  Attachments?: PostmarkAttachment[];
}

const MAX_BODY = 10 * 1024 * 1024; // bumped to 10 MB once attachments are in scope
const MAX_ATTACHMENT = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_EMAIL = 10;
const ALLOWED_ATTACHMENT_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
]);

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractToken(payload: PostmarkInbound): string | null {
  const fromHash = payload.ToFull?.find((a) => a.MailboxHash)?.MailboxHash;
  if (fromHash) return fromHash.toLowerCase();
  const candidate = payload.OriginalRecipient ?? payload.ToFull?.[0]?.Email ?? '';
  const m = /\+([^@]+)@/.exec(candidate);
  return m ? m[1]!.toLowerCase() : null;
}

export async function POST(req: NextRequest) {
  const expected = process.env.EMAIL_INBOUND_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'Inbound disabled' }, { status: 503 });
  }
  const auth = req.headers.get('authorization') ?? '';
  const presented = auth.replace(/^Bearer\s+/i, '');
  if (!presented || !constantTimeEquals(presented, expected)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const lenHeader = req.headers.get('content-length');
  if (lenHeader && Number(lenHeader) > MAX_BODY) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  const text = await req.text();
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let payload: PostmarkInbound;
  try {
    payload = JSON.parse(text) as PostmarkInbound;
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const token = extractToken(payload);
  if (!token) return NextResponse.json({ error: 'No routing token' }, { status: 400 });

  const [alias] = await db
    .select({ userId: emailAliases.userId })
    .from(emailAliases)
    .where(eq(emailAliases.token, token))
    .limit(1);
  if (!alias) return NextResponse.json({ error: 'Unknown alias' }, { status: 404 });

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, alias.userId))
    .limit(1);
  if (!user) return NextResponse.json({ error: 'Unknown user' }, { status: 404 });

  const fromEmail = (payload.FromFull?.Email ?? payload.From ?? '').toLowerCase().trim();
  if (!fromEmail || fromEmail !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Sender not authorized' }, { status: 403 });
  }

  const subject = (payload.Subject ?? '').trim().slice(0, 200) || 'Email';
  const bodyText =
    payload.StrippedTextReply?.trim() ||
    payload.TextBody?.trim() ||
    (payload.HtmlBody ? htmlToText(payload.HtmlBody) : '') ||
    '';
  const plaintext = bodyText.slice(0, 64 * 1024);

  const [createdNote] = await db
    .insert(notes)
    .values({
      ownerId: alias.userId,
      title: subject,
      plaintext,
      position: Date.now(),
    })
    .returning({ id: notes.id });

  // Best-effort attachment upload. Failures don't block note creation.
  let attached = 0;
  if (
    createdNote &&
    Array.isArray(payload.Attachments) &&
    payload.Attachments.length > 0 &&
    isAssetsConfigured()
  ) {
    const slice = payload.Attachments.slice(0, MAX_ATTACHMENTS_PER_EMAIL);
    for (const att of slice) {
      try {
        const mime = (att.ContentType ?? 'application/octet-stream').toLowerCase();
        if (!ALLOWED_ATTACHMENT_MIME.has(mime)) continue;
        if (!att.Content) continue;
        const buf = Buffer.from(att.Content, 'base64');
        if (buf.byteLength === 0 || buf.byteLength > MAX_ATTACHMENT) continue;

        const key = buildKey({
          noteId: createdNote.id,
          ownerId: alias.userId,
          filename: att.Name ?? 'attachment',
          mime,
        });
        const putUrl = presign({
          method: 'PUT',
          key,
          contentType: mime,
          expiresInSeconds: 300,
        });
        const putRes = await fetch(putUrl, {
          method: 'PUT',
          body: buf,
          headers: { 'Content-Type': mime },
        });
        if (!putRes.ok) continue;
        const url = publicUrlFor(key);
        await db.insert(assets).values({
          noteId: createdNote.id,
          ownerId: alias.userId,
          url,
          mime,
          sizeBytes: buf.byteLength,
        });
        attached += 1;
      } catch {
        /* swallow per-attachment failure */
      }
    }
  }

  return NextResponse.json({ ok: true, attached });
}
