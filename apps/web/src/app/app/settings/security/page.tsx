import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Languages, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { db, eq, desc, webauthnCredentials } from '@notai/db';
import { auth } from '@/auth';
import { PasskeyManager } from '@/components/settings/passkey-manager';
import { TotpManager } from '@/components/settings/totp-manager';
import { DangerZone } from '@/components/settings/danger-zone';
import { LocaleSwitcher } from '@/components/settings/locale-switcher';
import { getDeletionStatus } from '@/server/actions/account-deletion';
import { getTotpStatus } from '@/server/totp';

export const metadata = { title: 'Security — Notai' };
export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/security');

  const [creds, deletion, totp] = await Promise.all([
    db
      .select({
        id: webauthnCredentials.id,
        label: webauthnCredentials.label,
        deviceType: webauthnCredentials.deviceType,
        backedUp: webauthnCredentials.backedUp,
        transports: webauthnCredentials.transports,
        lastUsedAt: webauthnCredentials.lastUsedAt,
        createdAt: webauthnCredentials.createdAt,
      })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, session.user.id))
      .orderBy(desc(webauthnCredentials.createdAt)),
    getDeletionStatus(),
    getTotpStatus(session.user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-10">
      <div>
        <Link
          href="/app"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-3.5" /> Back to app
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="text-primary size-6" /> Security
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Add a passkey for fast, phishing-resistant sign-in. Works with Touch ID, Face ID, Windows
          Hello, or any FIDO2 hardware key.
        </p>
      </div>

      <section className="bg-card rounded-2xl border p-6">
        <div className="mb-4 flex items-center gap-2">
          <Languages className="size-4" />
          <h2 className="text-base font-medium">Language</h2>
        </div>
        <p className="text-muted-foreground mb-3 text-sm">
          Notai will display in your chosen language. Note content is never translated.
        </p>
        <LocaleSwitcher />
      </section>

      <section className="bg-card rounded-2xl border p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="size-4" />
          <h2 className="text-base font-medium">Passkeys</h2>
        </div>
        <PasskeyManager
          initial={creds.map((c) => ({
            id: c.id,
            label: c.label,
            deviceType: c.deviceType,
            backedUp: c.backedUp,
            transports: c.transports,
            lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
            createdAt: c.createdAt.toISOString(),
          }))}
        />
      </section>

      <section className="bg-card rounded-2xl border p-6">
        <div className="mb-4 flex items-center gap-2">
          <Smartphone className="size-4" />
          <h2 className="text-base font-medium">Authenticator app (TOTP)</h2>
        </div>
        <TotpManager initial={totp} />
      </section>

      <section className="border-destructive/30 bg-destructive/5 rounded-2xl border p-6">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="text-destructive size-4" />
          <h2 className="text-base font-medium">Delete account</h2>
        </div>
        <DangerZone deletion={deletion} userEmail={session.user.email ?? ''} />
      </section>
    </div>
  );
}
