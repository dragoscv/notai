'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowLeft, PenLine, RefreshCw } from 'lucide-react';
import { Button } from '@notai/ui/components/button';

/**
 * Top-level error boundary for the web app. Mirrors the landing page's warm
 * aurora language so a crash still feels on-brand.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== 'undefined') console.error(error);
  }, [error]);

  return (
    <div className="bg-background text-foreground relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-primary/20 absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full blur-3xl" />
        <div className="bg-destructive/15 absolute -right-32 top-[18rem] h-[28rem] w-[28rem] rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-50 dark:opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(color-mix(in oklab, var(--foreground) 18%, transparent) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 80%)',
          }}
        />
      </div>

      <Link
        href="/"
        className="text-muted-foreground hover:bg-card/60 hover:text-foreground absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Home
      </Link>

      <div className="relative mx-auto w-full max-w-md">
        <div className="bg-card/80 shadow-foreground/5 relative overflow-hidden rounded-2xl border p-8 shadow-xl backdrop-blur">
          <span className="bg-background/60 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px]">
            <span className="bg-destructive size-1.5 rounded-full" />
            Something went sideways
          </span>

          <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
            That didn&apos;t go as planned.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            We hit an unexpected snag. Your notes are safe — try again, or head back to the app.
          </p>

          {error.message && (
            <p className="bg-background/60 text-muted-foreground mt-4 rounded-md border px-3 py-2 text-xs">
              {error.message}
            </p>
          )}
          {error.digest && (
            <p className="text-muted-foreground mt-2 font-mono text-[11px]">ref: {error.digest}</p>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button onClick={reset} className="shadow-primary/20 flex-1 shadow-sm">
              <RefreshCw /> Try again
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/app">
                <PenLine /> Back to notes
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
