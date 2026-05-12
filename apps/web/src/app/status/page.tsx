import type { Metadata } from 'next';
import { StatusBoard } from './status-board';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Status — Notai',
  description: 'Live operational status of the Notai service.',
  robots: { index: true, follow: true },
};

export default function StatusPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Notai status</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Live health of the services powering notai.ro. Auto-refreshes every 30 seconds.
        </p>
      </header>
      <StatusBoard />
      <footer className="text-muted-foreground mt-10 text-xs">
        For incident updates follow{' '}
        <a className="underline" href="https://x.com/notaiapp">
          @notaiapp
        </a>{' '}
        or email{' '}
        <a className="underline" href="mailto:support@notai.ro">
          support@notai.ro
        </a>
        .
      </footer>
    </main>
  );
}
