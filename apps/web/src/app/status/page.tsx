import type { Metadata } from 'next';
import { auth } from '@/auth';
import {
  AuroraBackground,
  MarketingFooter,
  MarketingHeader,
} from '@/components/marketing/site-shell';
import { StatusBoard } from './status-board';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Status',
  description: 'Live operational status of the Notai service.',
  alternates: { canonical: '/status' },
  robots: { index: true, follow: true },
};

export default async function StatusPage() {
  const session = await auth();
  return (
    <div className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <AuroraBackground />
      <MarketingHeader signedIn={!!session?.user} />

      <main className="relative">
        <section className="mx-auto max-w-2xl px-6 pt-16 sm:pt-20">
          <p className="text-primary text-xs font-semibold uppercase tracking-wider">Status</p>
          <h1 className="mt-2 text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Notai status
          </h1>
          <p className="text-muted-foreground mt-5 text-pretty text-lg">
            Live health of the services powering notai.ro. Auto-refreshes every 30 seconds.
          </p>
        </section>

        <section className="mx-auto max-w-2xl px-6 pb-16 pt-10">
          <StatusBoard />
          <p className="text-muted-foreground mt-10 text-xs">
            For incident updates email{' '}
            <a className="underline" href="mailto:support@notai.ro">
              support@notai.ro
            </a>
            .
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
