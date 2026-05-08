'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';

const ContactSchema = z.object({
  name: z.string().min(1, 'Please enter your name.').max(120),
  email: z.string().email('Please enter a valid email address.').max(254),
  subject: z.string().min(3, 'Add a short subject.').max(160),
  message: z.string().min(10, 'A short message helps us help you.').max(5000),
  // Honeypot — must stay empty.
  website: z.string().max(0).optional().or(z.literal('')),
});

export type ContactState =
  | { status: 'idle' }
  | { status: 'success' }
  | {
      status: 'error';
      message?: string;
      fieldErrors?: Partial<Record<'name' | 'email' | 'subject' | 'message', string>>;
    };

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Public, unauthenticated server action that sends email — perfect
  // spam target. Throttle by IP: 5 messages / 10 minutes is enough for
  // a real human, painful for a bot.
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
  const rl = await rateLimit({
    name: 'contact',
    key: ip,
    windowSec: 600,
    max: 5,
  });
  if (!rl.ok) {
    return {
      status: 'error',
      message: 'Too many messages from your network. Please try again later.',
    };
  }

  const parsed = ContactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    subject: formData.get('subject'),
    message: formData.get('message'),
    website: formData.get('website'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    return { status: 'error', fieldErrors };
  }

  // Silently drop bot submissions (honeypot).
  if (parsed.data.website && parsed.data.website.length > 0) {
    return { status: 'success' };
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.CONTACT_INBOX ?? 'support@notai.ro';
    const from = process.env.CONTACT_FROM ?? 'Notai <noreply@notai.ro>';

    if (!apiKey) {
      // Dev fallback: acknowledge enough that someone running locally can
      // see the form path works, without dumping PII (name / email /
      // message body) into server logs.
      if (process.env.NODE_ENV === 'production') {
        return {
          status: 'error',
          message: 'Email service unavailable. Please try again later.',
        };
      }
      console.warn(
        '[contact] RESEND_API_KEY not set — would deliver message from <%s> to %s',
        parsed.data.email.replace(/^([^@]).*(@.*)$/, '$1…$2'),
        to,
      );
      return { status: 'success' };
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
        reply_to: parsed.data.email,
        subject: `[Notai contact] ${parsed.data.subject}`,
        text: `From: ${parsed.data.name} <${parsed.data.email}>\n\n${parsed.data.message}`,
      }),
    });

    if (!res.ok) {
      return {
        status: 'error',
        message: 'Could not send your message. Please try again or email us directly.',
      };
    }
  } catch {
    return {
      status: 'error',
      message: 'Could not send your message. Please try again or email us directly.',
    };
  }

  return { status: 'success' };
}
