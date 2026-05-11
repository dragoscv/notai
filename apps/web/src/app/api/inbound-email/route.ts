import { NextRequest, NextResponse } from 'next/server';
import { db, emailAliases, emailMessages, users, notes, assets, eq, and, sql } from '@notai/db';
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
  Headers?: Array<{ Name?: string; Value?: string }>;
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

/** Normalise a Message-ID: strip whitespace + angle brackets, lower-case. */
function normaliseMessageId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^<|>$/g, '').trim().toLowerCase();
  if (!s || s.length > 998) return null; // RFC 5322 line limit
  return s;
}

/** Collect candidate In-Reply-To + References Message-IDs from raw headers. */
function readThreadHeaders(payload: PostmarkInbound): string[] {
  const headers = payload.Headers ?? [];
  const found: string[] = [];
  for (const h of headers) {
    const name = h.Name?.toLowerCase();
    if (name !== 'in-reply-to' && name !== 'references') continue;
    const value = h.Value ?? '';
    // References can list multiple <id>s separated by whitespace.
    const ids = value.match(/<[^>]+>/g) ?? [value];
    for (const id of ids) {
      const norm = normaliseMessageId(id);
      if (norm) found.push(norm);
    }
  }
  return found;
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

  // Threading: if any In-Reply-To / References header matches a
  // previously-recorded inbound message, append to that note's
  // plaintext instead of creating a new note. Falls back to a fresh
  // note when nothing matches.
  const threadCandidates = readThreadHeaders(payload);
  let threadedNoteId: string | null = null;
  if (threadCandidates.length > 0) {
    const [hit] = await db
      .select({ noteId: emailMessages.noteId })
      .from(emailMessages)
      .where(sql`${emailMessages.messageId} = ANY(${threadCandidates})`)
      .limit(1);
    if (hit) {
      // Confirm the matched note still belongs to this alias before
      // mutating it — protects against stale message-id rows pointing
      // at notes that have changed owner via workspace moves.
      const [target] = await db
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.id, hit.noteId), eq(notes.ownerId, alias.userId)))
        .limit(1);
      if (target) threadedNoteId = target.id;
    }
  }

  let createdNote: { id: string } | undefined;
  if (threadedNoteId) {
    const divider = `\n\n--- Reply from ${fromEmail} at ${new Date().toISOString()} ---\n\n`;
    await db
      .update(notes)
      .set({
        plaintext: sql`coalesce(${notes.plaintext}, '') || ${divider + plaintext}`,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, threadedNoteId));
    createdNote = { id: threadedNoteId };
  } else {
    const [row] = await db
      .insert(notes)
      .values({
        ownerId: alias.userId,
        title: subject,
        plaintext,
        position: Date.now(),
      })
      .returning({ id: notes.id });
    createdNote = row;
  }

  // Record this email's own Message-ID so future replies can thread to it.
  const ownMessageId = normaliseMessageId(payload.MessageID);
  if (ownMessageId && createdNote) {
    await db
      .insert(emailMessages)
      .values({ messageId: ownMessageId, noteId: createdNote.id })
      .onConflictDoNothing();
  }

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
