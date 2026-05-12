import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@notai/ui/components/button';

export const metadata: Metadata = {
  title: 'Offline',
  description: "You're offline. Your local notes still work.",
  robots: { index: false, follow: false },
};

export const dynamic = 'force-static';

/**
 * Served by the service worker as a fallback when a navigation request
 * cannot be fulfilled (no network, no cached HTML). Local notes remain
 * available because they live in IndexedDB on the device.
 */
export default function OfflinePage() {
  return (
    <main className="bg-background text-foreground flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <p className="text-primary text-xs font-semibold uppercase tracking-wider">Offline</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight">
          You&rsquo;re offline.
        </h1>
        <p className="text-muted-foreground mt-4 text-pretty">
          Your local notes still work. New cloud syncs and AI features will resume the moment
          you&rsquo;re back online.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/app">Open my notes</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
