import { addSuppression } from '@/server/email-suppressions';
import { verifyUnsubscribeToken } from '@/server/unsubscribe-token';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Unsubscribe — Notai', robots: { index: false } };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const email = token ? verifyUnsubscribeToken(token) : null;

  if (!email) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Invalid unsubscribe link</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The link is missing or has been tampered with. If you keep receiving unwanted email,
          contact support.
        </p>
      </main>
    );
  }

  await addSuppression({
    email,
    reason: 'manual',
    source: 'unsubscribe.link',
    detail: 'one-click unsubscribe',
  });

  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">You&rsquo;re unsubscribed</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        We won&rsquo;t send <span className="font-mono">{maskEmail(email)}</span> any more email.
        Account-related security and billing notifications may still go through.
      </p>
    </main>
  );
}

function maskEmail(s: string) {
  return s.replace(/^(.).+(@.+)$/, '$1…$2');
}
