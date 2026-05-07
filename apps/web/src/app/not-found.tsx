import Link from 'next/link';
import { ArrowLeft, Compass, PenLine, Pin } from 'lucide-react';
import { Button } from '@notai/ui/components/button';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
    return (
        <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-6 py-16 text-foreground">
            {/* aurora */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute -right-32 top-[18rem] h-[28rem] w-[28rem] rounded-full bg-sticky-pink/40 blur-3xl dark:bg-sticky-purple/30" />
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

            <div className="relative mx-auto w-full max-w-2xl text-center">
                {/* Sticky note "404" */}
                <div className="relative mx-auto mb-10 h-44 w-72">
                    <div className="absolute inset-0 rotate-[-6deg] rounded-xl bg-sticky-yellow p-5 shadow-xl shadow-foreground/10">
                        <div className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-foreground/50 uppercase">
                            <Pin className="size-3" /> note
                        </div>
                        <div className="mt-1 font-serif text-7xl font-bold leading-none text-foreground/80">
                            404
                        </div>
                        <div className="mt-2 text-sm text-foreground/70">
                            Hmm. This page slipped off the board.
                        </div>
                    </div>
                    <div className="absolute -right-6 top-10 w-28 rotate-[10deg] rounded-md bg-sticky-pink p-2.5 text-[11px] leading-snug text-foreground/80 shadow-md">
                        <div className="text-[9px] font-medium tracking-wide text-foreground/50 uppercase">
                            todo
                        </div>
                        Find this page 🔎
                    </div>
                </div>

                <p className="text-xs font-medium tracking-wider text-primary uppercase">
                    Lost in the margins
                </p>
                <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                    We couldn&apos;t find that note.
                </h1>
                <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
                    The page you&apos;re looking for might have been moved, deleted, or never
                    existed. Let&apos;s get you back to your notebook.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                        <Link href="/app">
                            <PenLine /> Open your notes
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="ghost">
                        <Link href="/">
                            <Compass /> Back to homepage
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
