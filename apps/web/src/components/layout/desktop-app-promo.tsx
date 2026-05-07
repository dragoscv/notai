'use client';
import * as React from 'react';
import { Download, Monitor } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { cn } from '@notai/lib/utils';
import { isTauri } from '@/lib/tauri';
import {
    DESKTOP_DOWNLOAD_URL,
    hasLaunchedDesktop,
    launchDesktop,
} from '@/lib/desktop-app';

/**
 * Sidebar-footer promo for the desktop app.
 *
 * - Hidden entirely when already running inside Tauri.
 * - First-time: shows "Download for Desktop".
 * - After the user clicks Download OR successfully opens via `notai://`:
 *   swaps to "Open desktop app".
 */
export function DesktopAppPromo({ collapsed }: { collapsed: boolean }) {
    const [mounted, setMounted] = React.useState(false);
    const [launched, setLaunched] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        setLaunched(hasLaunchedDesktop());
    }, []);

    // Avoid hydration mismatch: render nothing until mounted, then decide.
    if (!mounted) return null;
    if (isTauri()) return null;

    if (launched) {
        return (
            <Button
                variant="ghost"
                size={collapsed ? 'icon-sm' : 'sm'}
                onClick={() => launchDesktop()}
                className={cn(
                    'gap-2',
                    collapsed ? 'mx-auto' : 'w-full justify-start',
                )}
                title="Open desktop app"
            >
                <Monitor className="size-4" />
                {!collapsed && <span>Open desktop app</span>}
            </Button>
        );
    }

    return (
        <a
            href={DESKTOP_DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(
                'inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                collapsed ? 'mx-auto size-8 justify-center p-0' : 'w-full justify-start',
            )}
            title="Download desktop app"
        >
            <Download className="size-4" />
            {!collapsed && <span>Get desktop app</span>}
        </a>
    );
}
