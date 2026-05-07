import Link from 'next/link';
import { ArrowRight, PenLine, StickyNote, Users } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { ThemeToggle } from '@notai/ui/components/theme-toggle';
import { auth } from '@/auth';

export default async function LandingPage() {
    const session = await auth();
    return (
        <main className="relative min-h-dvh overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,theme(colors.primary/0.12),transparent_60%)]" />

            <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
                <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                    <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
                        <PenLine className="size-4" />
                    </span>
                    Notai
                </Link>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    {session?.user ? (
                        <Button asChild size="sm">
                            <Link href="/app">Open app</Link>
                        </Button>
                    ) : (
                        <Button asChild size="sm">
                            <Link href="/signin">Sign in</Link>
                        </Button>
                    )}
                </div>
            </nav>

            <section className="mx-auto max-w-3xl px-6 pt-16 pb-24 text-center sm:pt-28">
                <span className="mb-5 inline-flex rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                    Built for focus · Works offline · Syncs in realtime
                </span>
                <h1 className="font-serif text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
                    Your calm place to{' '}
                    <span className="bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
                        think
                    </span>
                    .
                </h1>
                <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground">
                    Draw with your S Pen, capture checklists, and keep sticky notes floating on your desktop.
                    Every keystroke syncs across your devices — even offline.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button asChild size="lg">
                        <Link href={session?.user ? '/app' : '/signin'}>
                            {session?.user ? 'Open your notes' : 'Get started'} <ArrowRight />
                        </Link>
                    </Button>
                </div>
            </section>

            <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
                <Feature
                    icon={<PenLine />}
                    title="Write & draw"
                    text="Rich text, task lists, and a pressure-sensitive canvas. Palm rejection for S Pen."
                />
                <Feature
                    icon={<StickyNote />}
                    title="Sticky notes"
                    text="Install as a desktop app to pin notes on top of everything, always visible."
                />
                <Feature
                    icon={<Users />}
                    title="Realtime sync"
                    text="Open a note on your phone and laptop — they stay in sync, even offline."
                />
            </section>
        </main>
    );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
    return (
        <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
            <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-4">
                {icon}
            </div>
            <h3 className="mt-4 font-medium">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        </div>
    );
}
