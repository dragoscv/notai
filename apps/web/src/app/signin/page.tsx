import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, PenLine, Pin, Sparkles } from 'lucide-react';
import { auth } from '@/auth';
import { signInWithGoogle } from '@/server/actions/auth';
import { SignInGoogleButton } from '@/components/auth/sign-in-google-button';

export default async function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{ callbackUrl?: string }>;
}) {
    const session = await auth();
    const { callbackUrl } = await searchParams;
    if (session?.user) {
        redirect(isSafeCallback(callbackUrl) ? callbackUrl! : '/app');
    }

    return (
        <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
            <AuroraBackground />

            <Link
                href="/"
                className="absolute top-5 left-5 z-20 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground"
            >
                <ArrowLeft className="size-3.5" /> Back
            </Link>

            <main className="relative mx-auto grid min-h-dvh max-w-6xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
                {/* Left: brand panel (desktop only) */}
                <aside className="relative hidden lg:block">
                    <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
                        <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/30">
                            <PenLine className="size-4" />
                        </span>
                        <span className="text-base">Notai</span>
                    </Link>

                    <h2 className="mt-10 max-w-md font-serif text-4xl leading-[1.1] font-semibold tracking-tight text-balance xl:text-5xl">
                        Pick up exactly where you{' '}
                        <span className="bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
                            left off
                        </span>
                        .
                    </h2>
                    <p className="mt-4 max-w-md text-pretty text-muted-foreground">
                        Your sticky notes, drawings, and lists are waiting on every device — synced
                        the moment you sign in.
                    </p>

                    <StickyShowcase />
                </aside>

                {/* Right: auth card */}
                <section className="relative mx-auto w-full max-w-md">
                    {/* Mobile-only logo */}
                    <Link
                        href="/"
                        className="mb-6 inline-flex items-center gap-2 font-semibold tracking-tight lg:hidden"
                    >
                        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/30">
                            <PenLine className="size-4" />
                        </span>
                        Notai
                    </Link>

                    <div className="relative rounded-2xl border bg-card/80 p-7 shadow-xl shadow-foreground/5 backdrop-blur sm:p-9">
                        {/* subtle inner highlight */}
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
                            style={{
                                background:
                                    'radial-gradient(600px 200px at 0% 0%, color-mix(in oklab, var(--primary) 8%, transparent), transparent 60%)',
                            }}
                        />

                        <div className="relative">
                            <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                                <Sparkles className="size-3 text-primary" />
                                Free · No credit card
                            </span>

                            <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                                Welcome back.
                            </h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Sign in to your calm place to think.
                            </p>

                            <form
                                className="mt-7"
                                action={async () => {
                                    'use server';
                                    await signInWithGoogle(callbackUrl);
                                }}
                            >
                                <SignInGoogleButton>
                                    <GoogleLogo /> Continue with Google
                                </SignInGoogleButton>
                            </form>

                            <ul className="mt-7 space-y-2 text-sm text-muted-foreground">
                                <Bullet>End-to-end synced across web, desktop & mobile</Bullet>
                                <Bullet>Works fully offline — even your first session</Bullet>
                                <Bullet>We never train on your notes</Bullet>
                            </ul>

                            <p className="mt-7 text-center text-[11px] text-muted-foreground">
                                By continuing you agree to the terms and privacy policy.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

/* ─────────────────────── helpers ─────────────────────── */

function isSafeCallback(url: string | undefined): url is string {
    return !!url && url.startsWith('/') && !url.startsWith('//');
}

function Bullet({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-2">
            <span className="mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Check className="size-2.5" />
            </span>
            <span>{children}</span>
        </li>
    );
}

function AuroraBackground() {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute top-[20rem] -right-40 h-[32rem] w-[32rem] rounded-full bg-sticky-pink/40 blur-3xl dark:bg-sticky-purple/30" />
            <div
                className="absolute inset-0 opacity-50 dark:opacity-25"
                style={{
                    backgroundImage:
                        'radial-gradient(color-mix(in oklab, var(--foreground) 18%, transparent) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                    maskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 75%)',
                }}
            />
        </div>
    );
}

function StickyShowcase() {
    return (
        <div className="relative mt-16 h-72 w-full max-w-md">
            <div className="absolute -left-2 top-0 w-48 rotate-[-7deg] rounded-md bg-sticky-yellow p-3 text-[13px] leading-snug text-foreground/80 shadow-lg shadow-foreground/10">
                <div className="mb-1 flex items-center gap-1 text-[10px] font-medium tracking-wide text-foreground/50 uppercase">
                    <Pin className="size-3" /> pinned
                </div>
                Pick up the kids at 4 — bring umbrella ☔
            </div>

            <div className="absolute right-0 top-12 w-52 rotate-[5deg] rounded-md bg-sticky-pink p-3 text-[13px] leading-snug text-foreground/80 shadow-lg shadow-foreground/10">
                <div className="mb-1 text-[10px] font-medium tracking-wide text-foreground/50 uppercase">
                    Idea
                </div>
                &ldquo;What if onboarding was just one beautiful sticky note?&rdquo;
            </div>

            <div className="absolute -left-1 bottom-12 w-44 rotate-[4deg] rounded-md bg-sticky-blue p-3 text-[13px] leading-snug text-foreground/80 shadow-lg shadow-foreground/10">
                <div className="mb-1 text-[10px] font-medium tracking-wide text-foreground/50 uppercase">
                    Reading
                </div>
                Deep Work · ch.4 — focus rituals
            </div>

            <div className="absolute right-4 bottom-0 w-44 rotate-[-3deg] rounded-md bg-sticky-green p-3 text-[13px] leading-snug text-foreground/80 shadow-lg shadow-foreground/10">
                <div className="mb-1 text-[10px] font-medium tracking-wide text-foreground/50 uppercase">
                    Workout
                </div>
                Tue · Thu · Sat — 30 min run 🏃
            </div>
        </div>
    );
}

function GoogleLogo() {
    return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.11c-.22-.66-.35-1.37-.35-2.11s.13-1.45.35-2.11V7.05H2.18A10.99 10.99 0 0 0 1 12c0 1.77.43 3.45 1.18 4.95l3.66-2.84z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
            />
        </svg>
    );
}
