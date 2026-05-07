import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PenLine } from 'lucide-react';
import { auth } from '@/auth';
import { signInWithGoogle } from '@/server/actions/auth';
import { SignInGoogleButton } from '@/components/auth/sign-in-google-button';
import { Card } from '@notai/ui/components/card';

export default async function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{ callbackUrl?: string }>;
}) {
    const session = await auth();
    const { callbackUrl } = await searchParams;
    if (session?.user) {
        // If the sign-in page was opened for a desktop handoff, forward
        // the already-authenticated browser session straight to the
        // handoff-issuing endpoint instead of the app.
        redirect(isSafeCallback(callbackUrl) ? callbackUrl! : '/app');
    }

    return (
        <main className="grid min-h-dvh place-items-center p-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,theme(colors.primary/0.12),transparent_60%)]" />

            <Card className="w-full max-w-sm p-8 shadow-xl">
                <Link href="/" className="mb-6 flex items-center gap-2 font-semibold">
                    <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
                        <PenLine className="size-4" />
                    </span>
                    Notai
                </Link>
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Sign in to access your notes across all your devices.
                </p>

                <form
                    className="mt-6"
                    action={async () => {
                        'use server';
                        await signInWithGoogle(callbackUrl);
                    }}
                >
                    <SignInGoogleButton>
                        <GoogleLogo /> Continue with Google
                    </SignInGoogleButton>
                </form>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    By continuing you agree to the terms and privacy policy.
                </p>
            </Card>
        </main>
    );
}

function isSafeCallback(url: string | undefined): url is string {
    // Only allow same-origin relative paths to prevent open-redirects.
    return !!url && url.startsWith('/') && !url.startsWith('//');
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
