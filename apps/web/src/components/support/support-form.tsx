'use client';

import * as React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button, Input, Textarea, Label } from '@notai/ui';
import { createSupportTicket, type CreateTicketState } from '@/server/actions/support';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'general', label: 'General question' },
  { value: 'billing', label: 'Billing & subscriptions' },
  { value: 'bug', label: 'Bug report' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'account', label: 'Account help' },
  { value: 'gdpr', label: 'Privacy / GDPR request' },
  { value: 'other', label: 'Other' },
];

export function SupportForm({
  defaultName,
  defaultEmail,
  defaultCategory,
  compact = false,
}: {
  defaultName?: string;
  defaultEmail?: string;
  defaultCategory?: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<CreateTicketState, FormData>(
    createSupportTicket,
    { status: 'idle' },
  );

  if (state.status === 'success' && state.reference !== 'NT-DROPPED') {
    return (
      <div className="border-border/60 bg-card/40 rounded-xl border p-6">
        <h3 className="text-base font-semibold">Got it — we&apos;ll be in touch.</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Reference{' '}
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{state.reference}</code>. A copy
          went to the inbox you provided. Replies arrive by email; if you&apos;re signed in you can
          also follow the thread under{' '}
          <Link className="underline" href="/support">
            My support
          </Link>
          .
        </p>
      </div>
    );
  }

  const fe = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4">
      {/* Honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className={compact ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-2'}>
        <Field id="name" label="Your name" error={fe?.name}>
          <Input
            id="name"
            name="name"
            required
            maxLength={120}
            defaultValue={defaultName}
            autoComplete="name"
          />
        </Field>
        <Field id="email" label="Email" error={fe?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            defaultValue={defaultEmail}
            autoComplete="email"
          />
        </Field>
      </div>

      <Field id="category" label="Category" error={fe?.category}>
        <select
          id="category"
          name="category"
          defaultValue={defaultCategory ?? 'general'}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field id="subject" label="Subject" error={fe?.subject}>
        <Input id="subject" name="subject" required minLength={3} maxLength={160} />
      </Field>

      <Field id="body" label="Message" error={fe?.body}>
        <Textarea id="body" name="body" required minLength={10} maxLength={8000} rows={8} />
      </Field>

      {state.status === 'error' && state.message ? (
        <p className="text-destructive text-sm">{state.message}</p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          By submitting, you agree to our{' '}
          <a className="underline" href="/privacy-policy">
            privacy policy
          </a>
          .
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Send className="mr-1.5 size-3.5" />
          )}
          Send
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-medium uppercase tracking-wider">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
      {error ? <p className="text-destructive mt-1 text-xs">{error}</p> : null}
    </div>
  );
}
