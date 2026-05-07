'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
    PenLine,
    Star,
    Archive,
    Search,
    Settings,
    LogOut,
    Home,
} from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { Avatar, AvatarImage, AvatarFallback } from '@notai/ui/components/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@notai/ui/components/dropdown-menu';
import { ThemeToggle } from '@notai/ui/components/theme-toggle';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';
import { cn, getInitials } from '@notai/lib/utils';
import { signOutAction } from '@/server/actions/auth';
import { createNote } from '@/server/actions/notes';
import type { Note, Folder } from '@notai/db/schema';
import { OpenStickiesButton } from '@/components/note/open-stickies-button';
import { SidebarTree } from '@/components/layout/sidebar-tree';
import { DesktopAppPromo } from '@/components/layout/desktop-app-promo';
import {
    SettingsDialog,
    useSettingsOpenRequests,
} from '@/components/settings/settings-dialog';

interface SidebarProps {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
    notes: Note[];
    folders: Folder[];
}

export function Sidebar({ user, notes, folders }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [settingsOpen, setSettingsOpen] = React.useState(false);

    useHotkey('mod+n', async () => {
        const note = await createNote();
        if (note) router.push(`/app/n/${note.id}`);
    });
    useHotkey('mod+,', () => setSettingsOpen(true));
    useSettingsOpenRequests(() => setSettingsOpen(true));
    useHotkey('mod+k', () => {
        document.dispatchEvent(new CustomEvent('notai:command-palette'));
    });

    return (
        <aside className="relative flex h-full w-64 flex-col border-r bg-card/50 backdrop-blur">
            {/* Soft warm wash at the top to match the rest of the app */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 opacity-70"
                style={{
                    background:
                        'radial-gradient(220px 140px at 50% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 75%)',
                }}
            />

            {/* Brand */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <Link
                    href="/app"
                    className="flex items-center gap-2 rounded-md px-1 py-0.5 font-semibold tracking-tight transition-colors hover:bg-accent/40"
                >
                    <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/30">
                        <PenLine className="size-3.5" />
                    </span>
                    <span className="font-serif text-base">Notai</span>
                </Link>
                <ThemeToggle />
            </div>

            {/* Search trigger */}
            <div className="px-3 pb-3">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start bg-background/60 text-muted-foreground hover:bg-accent/60"
                    onClick={() => document.dispatchEvent(new CustomEvent('notai:command-palette'))}
                >
                    <Search /> Search…
                    <kbd className="ml-auto rounded border bg-card px-1 font-mono text-[10px] text-foreground/60">
                        ⌘K
                    </kbd>
                </Button>
            </div>

            {/* Top nav */}
            <nav className="space-y-0.5 px-2">
                <NavItem href="/app" icon={<Home />} label="Today" active={pathname === '/app'} />
                <NavItem href="/app?filter=favorites" icon={<Star />} label="Favorites" />
                <NavItem href="/app?filter=archived" icon={<Archive />} label="Archived" />
            </nav>

            {/* Folder + note tree (consumes leftover space) */}
            <SidebarTree folders={folders} notes={notes} />

            {/* Desktop promo (auto-hides inside Tauri) */}
            <div className="px-2 py-1.5">
                <DesktopAppPromo collapsed={false} />
            </div>

            <div className="border-t px-2 py-1.5">
                <OpenStickiesButton variant="inline" />
            </div>

            {/* Account */}
            <div className="border-t bg-card/30 p-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-accent">
                            <Avatar className="size-7 ring-2 ring-card">
                                {user.image && (
                                    <AvatarImage src={user.image} alt={user.name ?? 'user'} />
                                )}
                                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-[10px] font-medium text-foreground/80">
                                    {getInitials(user.name, user.email)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{user.name ?? 'Anon'}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {user.email}
                                </p>
                            </div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" className="w-56">
                        <DropdownMenuLabel>My account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                            <Settings /> Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={async () => {
                                await signOutAction();
                            }}
                            className="text-destructive focus:text-destructive"
                        >
                            <LogOut /> Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <SettingsDialog user={user} open={settingsOpen} onOpenChange={setSettingsOpen} />
        </aside>
    );
}

function NavItem({
    href,
    icon,
    label,
    active,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    active?: boolean;
}) {
    return (
        <Link
            href={href}
            className={cn(
                'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-4',
                active &&
                    'bg-accent text-accent-foreground shadow-sm ring-1 ring-primary/15 [&_svg]:text-primary',
            )}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}
