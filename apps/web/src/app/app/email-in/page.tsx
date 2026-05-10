import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getOrCreateEmailAlias } from '@/server/actions/email-alias';
import { EmailAliasManager } from '@/components/settings/email-alias-manager';

export const metadata = { title: 'Email-to-note' };

export default async function EmailInPage() {
  const alias = await getOrCreateEmailAlias();
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/app"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Email-to-note</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Forward or compose an email to your secret address; the subject becomes the note title and
        the body becomes the note. Only mail from your account email address is accepted.
      </p>

      {!alias.configured && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Inbound email isn&apos;t configured on this deployment yet (
          <code>EMAIL_INBOUND_DOMAIN</code> not set). Your address is shown for preview but mail to
          it won&apos;t arrive.
        </div>
      )}

      <div className="mt-6">
        <EmailAliasManager initial={alias} />
      </div>

      <details className="text-muted-foreground mt-8 text-xs">
        <summary className="cursor-pointer">How does this work?</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            The <code>+TOKEN</code> in your address routes mail to your account. Treat it like a
            password — anyone who knows it can create notes in your account.
          </li>
          <li>Mail must come from your account email; spoofed senders are rejected.</li>
          <li>HTML emails are converted to plain text. Attachments are not yet stored.</li>
        </ul>
      </details>
    </div>
  );
}
