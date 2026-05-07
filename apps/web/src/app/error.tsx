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
        <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-6 py-16 text-foreground">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute -right-32 top-[18rem] h-[28rem] w-[28rem] rounded-full bg-destructive/15 blur-3xl" />
                <div
                    className="absolute inset-0 opacity-50 dark:opacity-25"
                    style={{
                        backgroundImage:
                            'radial-gradient(color-mix(in oklab, var(--foreground) 18%, transparent) 1px, transparent 1px)',
                        backgroundSize: '28px 28px',
                        maskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 80%)',
                        WebkitMaskImage:
                            'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 80%)',
                    }}
                />
            </div>

            <Link
                href="/"
                className="absolute top-5 left-5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground"
            >
                <ArrowLeft className="size-3.5" /> Home
            </Link>

            <div className="relative mx-auto w-full max-w-md">
                <div className="relative overflow-hidden rounded-2xl border bg-card/80 p-8 shadow-xl shadow-foreground/5 backdrop-blur">
                    <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-destructive" />
                        Something went sideways
                    </span>

                    <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
                        That didn&apos;t go as planned.
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        We hit an unexpected snag. Your notes are safe — try again, or head back to
                        the app.
                    </p>

                    {error.message && (
                        <p className="mt-4 rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                            {error.message}
                        </p>
                    )}
                    {error.digest && (
                        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                            ref: {error.digest}
                        </p>
                    )}

                    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                        <Button onClick={reset} className="flex-1 shadow-sm shadow-primary/20">
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
