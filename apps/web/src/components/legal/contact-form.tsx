'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@notai/ui/components/button';
import { Input } from '@notai/ui/components/input';
import { Label } from '@notai/ui/components/label';
import { Textarea } from '@notai/ui/components/textarea';
import { sendContactMessage, type ContactState } from '@/server/actions/contact';

const INITIAL: ContactState = { status: 'idle' };

export function ContactForm() {
    const [state, formAction] = useActionState(sendContactMessage, INITIAL);

    if (state.status === 'success') {
        return (
            <div
                role="status"
                aria-live="polite"
                className="not-prose rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm"
            >
                <p className="font-medium text-foreground">Thanks — your message is on its way.</p>
                <p className="mt-1 text-muted-foreground">
                    We aim to reply within two working days. Check your spam folder just in case.
                </p>
            </div>
        );
    }

    const fieldErrors =
        state.status === 'error' ? (state.fieldErrors ?? {}) : ({} as Record<string, string>);
    const formError = state.status === 'error' ? state.message : undefined;

    return (
        <form
            action={formAction}
            className="not-prose mt-2 grid gap-4"
            noValidate
            aria-describedby={formError ? 'contact-form-error' : undefined}
        >
            {formError ? (
                <p
                    id="contact-form-error"
                    role="alert"
                    className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                    {formError}
                </p>
            ) : null}

            <div className="grid gap-2">
                <Label htmlFor="contact-name">Your name</Label>
                <Input
                    id="contact-name"
                    name="name"
                    autoComplete="name"
                    required
                    aria-invalid={!!fieldErrors.name}
                    aria-describedby={fieldErrors.name ? 'contact-name-err' : undefined}
                />
                {fieldErrors.name ? (
                    <p id="contact-name-err" className="text-xs text-destructive">
                        {fieldErrors.name}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <Label htmlFor="contact-email">Your email</Label>
                <Input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'contact-email-err' : undefined}
                />
                {fieldErrors.email ? (
                    <p id="contact-email-err" className="text-xs text-destructive">
                        {fieldErrors.email}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <Label htmlFor="contact-subject">Subject</Label>
                <Input
                    id="contact-subject"
                    name="subject"
                    required
                    aria-invalid={!!fieldErrors.subject}
                    aria-describedby={fieldErrors.subject ? 'contact-subject-err' : undefined}
                />
                {fieldErrors.subject ? (
                    <p id="contact-subject-err" className="text-xs text-destructive">
                        {fieldErrors.subject}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                    id="contact-message"
                    name="message"
                    rows={6}
                    required
                    aria-invalid={!!fieldErrors.message}
                    aria-describedby={fieldErrors.message ? 'contact-message-err' : undefined}
                />
                {fieldErrors.message ? (
                    <p id="contact-message-err" className="text-xs text-destructive">
                        {fieldErrors.message}
                    </p>
                ) : null}
            </div>

            {/* Honeypot — visually and AT-hidden, real users never see this. */}
            <div aria-hidden className="hidden">
                <label htmlFor="contact-website">Website (leave empty)</label>
                <input
                    id="contact-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                />
            </div>

            <div className="flex items-center justify-end">
                <SubmitButton />
            </div>
        </form>
    );
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} aria-disabled={pending}>
            {pending ? 'Sending…' : 'Send message'}
        </Button>
    );
}
