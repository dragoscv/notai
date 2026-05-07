'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@notai/ui/components/button';
import { isTauri } from '@/lib/tauri';

/**
 * Google sign-in button.
 *
 * In a normal browser it submits the parent `<form>` (server action → Auth.js).
 * In the Tauri desktop app it opens the system browser instead, because
 * Google blocks OAuth inside embedded WebView2.
 */
export function SignInGoogleButton({ children }: { children: ReactNode }) {
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        setIsDesktop(isTauri());
    }, []);

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!isDesktop) return; // let the form submit normally
        e.preventDefault();

        const origin = window.location.origin;
        const target = `${origin}/signin?callbackUrl=${encodeURIComponent('/api/desktop-auth/issue')}`;
        try {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(target);
        } catch {
            type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
            const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke?: TauriInvoke } })
                .__TAURI_INTERNALS__;
            if (internals?.invoke) {
                await internals.invoke('plugin:opener|open_url', { url: target });
            }
        }
    };

    return (
        <Button
            type="submit"
            onClick={handleClick}
            className="w-full"
            size="lg"
            variant="outline"
        >
            {children}
        </Button>
    );
}
