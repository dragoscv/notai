import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { listConnectedApps, listMyClients } from '@/server/actions/oauth-clients';
import { ConnectedAppCard } from './connected-app-card';
import { MyClientCard } from './my-client-card';
import { CreateClientForm } from './create-client-form';

export const metadata = { title: 'Connected apps' };
export const dynamic = 'force-dynamic';

export default async function ConnectedAppsPage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/signin');

    const [connected, myClients] = await Promise.all([listConnectedApps(), listMyClients()]);

    return (
        <main className="mx-auto max-w-3xl space-y-12 px-6 py-10">
            <header>
                <h1 className="font-serif text-3xl font-semibold tracking-tight">
                    Connected apps
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Apps and AI agents you have allowed to access your notai. Revoke any time —
                    revocation invalidates all access and refresh tokens for the app.
                </p>
            </header>

            <section>
                <h2 className="font-serif text-lg font-semibold">Authorized</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    These apps can access your data with the scopes you granted.
                </p>

                <div className="mt-4 space-y-3">
                    {connected.length === 0 ? (
                        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                            No apps connected yet. Use the OAuth endpoints to integrate
                            another tool — or jump to the{' '}
                            <Link
                                href="/docs/oauth"
                                className="underline underline-offset-2"
                            >
                                docs
                            </Link>
                            .
                        </div>
                    ) : (
                        connected.map((app) => (
                            <ConnectedAppCard key={app.consentId} app={app} />
                        ))
                    )}
                </div>
            </section>

            <section>
                <h2 className="font-serif text-lg font-semibold">Developer · OAuth clients</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Register an OAuth client for your own integration (e.g.{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">metu</code>{' '}
                    pointing at this notai). The client secret is shown once at creation —
                    store it somewhere safe.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <CreateClientForm />
                    <div className="space-y-3">
                        {myClients.length === 0 ? (
                            <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                                No clients yet.
                            </div>
                        ) : (
                            myClients.map((c) => <MyClientCard key={c.id} client={c} />)
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border bg-card p-6">
                <h2 className="font-serif text-lg font-semibold">Endpoints</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Discovery URLs for any OAuth/MCP client.
                </p>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-[max-content_1fr]">
                    {[
                        ['Authorization Server', '/.well-known/oauth-authorization-server'],
                        ['OpenID Configuration', '/.well-known/openid-configuration'],
                        ['Protected Resource (MCP)', '/.well-known/oauth-protected-resource'],
                        ['Dynamic Client Registration', '/api/oauth/register'],
                        ['MCP endpoint', '/api/mcp'],
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
            <dt className="font-medium text-foreground">{label}</dt>
            <dd>
                <code className="break-all text-muted-foreground">{href}</code>
            </dd>
        </>
    );
}
