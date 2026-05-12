import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { listConnectedApps, listMyClients } from '@/server/actions/oauth-clients';
import { ConnectedAppCard } from './connected-app-card';
import { MyClientCard } from './my-client-card';
import { CreateClientForm } from './create-client-form';

export async function generateMetadata() {
  const t = await getTranslations('settings.pages.connectedApps');
  return { title: t('title') };
}
export const dynamic = 'force-dynamic';

export default async function ConnectedAppsPage() {
  const t = await getTranslations('settings.pages.connectedApps');
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const [connected, myClients] = await Promise.all([listConnectedApps(), listMyClients()]);

  return (
    <main className="mx-auto max-w-3xl space-y-12 px-6 py-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{t('heading')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('intro')}</p>
      </header>

      <section>
        <h2 className="font-serif text-lg font-semibold">{t('authorizedHeading')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('authorizedDesc')}</p>

        <div className="mt-4 space-y-3">
          {connected.length === 0 ? (
            <div className="bg-muted/30 text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
              {t('emptyAuthorizedPrefix')}{' '}
              <Link href="/docs/oauth" className="underline underline-offset-2">
                {t('docs')}
              </Link>
              .
            </div>
          ) : (
            connected.map((app) => <ConnectedAppCard key={app.consentId} app={app} />)
          )}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-lg font-semibold">{t('developerHeading')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('developerDescPrefix')}{' '}
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs">metu</code>{' '}
          {t('developerDescSuffix')}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CreateClientForm />
          <div className="space-y-3">
            {myClients.length === 0 ? (
              <div className="bg-muted/30 text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
                {t('noClients')}
              </div>
            ) : (
              myClients.map((c) => <MyClientCard key={c.id} client={c} />)
            )}
          </div>
        </div>
      </section>

      <section className="bg-card rounded-2xl border p-6">
        <h2 className="font-serif text-lg font-semibold">{t('endpointsHeading')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('endpointsDesc')}</p>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-[max-content_1fr]">
          {[
            [t('epAuth'), '/.well-known/oauth-authorization-server'],
            [t('epOidc'), '/.well-known/openid-configuration'],
            [t('epProtected'), '/.well-known/oauth-protected-resource'],
            [t('epDcr'), '/api/oauth/register'],
            [t('epMcp'), '/api/mcp'],
          ].map(([label, href]) => (
            <Endpoint key={href} label={label!} href={href!} />
          ))}
        </dl>
      </section>
    </main>
  );
}

function Endpoint({ label, href }: { label: string; href: string }) {
  return (
    <>
      <dt className="text-foreground font-medium">{label}</dt>
      <dd>
        <code className="text-muted-foreground break-all">{href}</code>
      </dd>
    </>
  );
}
