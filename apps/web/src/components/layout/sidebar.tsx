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
  Shield,
  Sparkles,
  CalendarDays,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  X,
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
import { useSidebar } from '@/components/layout/app-shell';
import { DesktopAppPromo } from '@/components/layout/desktop-app-promo';
import { SettingsDialog, useSettingsOpenRequests } from '@/components/settings/settings-dialog';
import { NotificationBell } from '@/components/layout/notification-bell';
import { AppVersion } from '@/components/layout/app-version';

interface SidebarProps {
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  notes: Note[];
  folders: Folder[];
  isAdmin?: boolean;
}

export function Sidebar({ user, notes, folders, isAdmin = false }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const { mobileOpen, setMobileOpen, desktopCollapsed, toggleDesktop } = useSidebar();

  useHotkey('mod+n', async () => {
    const note = await createNote();
    if (note) router.push(`/app/n/${note.id}`);
  });
  useHotkey('mod+,', () => setSettingsOpen(true));
  useHotkey('mod+j', () => router.push('/app/today'));
  useHotkey('mod+\\', () => toggleDesktop());
  useSettingsOpenRequests(() => setSettingsOpen(true));
  useHotkey('mod+k', () => {
    document.dispatchEvent(new CustomEvent('notai:command-palette'));
  });

  // Auto-close the mobile drawer whenever the route changes — without this,
  // tapping a nav link on a phone navigates but leaves the drawer covering
  // the page.
  React.useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
    // Intentionally exclude mobileOpen/setMobileOpen — only react to nav.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Collapsed = icon rail (md+ only). On mobile we always show the full
  // drawer when it's open; mobile never uses the icon rail.
  const collapsed = desktopCollapsed;

  return (
    <aside
      aria-label="Primary navigation"
      id="app-sidebar"
      tabIndex={-1}
      data-focus-hide
      data-collapsed={collapsed}
      className={cn(
        'bg-card/50 relative flex h-full flex-col border-r backdrop-blur',
        'transition-[width,transform] duration-300 ease-out motion-reduce:transition-none',
        // Mobile: off-canvas drawer that slides in from the left.
        'fixed inset-y-0 left-0 z-40 w-72 shadow-xl md:shadow-none',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: in flow, no transform, width depends on collapsed state.
        'md:static md:translate-x-0',
        collapsed ? 'md:w-16' : 'md:w-64',
      )}
      onContextMenu={(e) => {
        // Suppress the native browser menu on sidebar items that don't
        // have their own ContextMenuTrigger. Radix triggers call
        // preventDefault first as the event bubbles up, so this only
        // takes effect on bare nav items / account button. The brand
        // link below stops propagation, so the browser menu still
        // appears there (it's the user's "right-click the logo to copy
        // link / open in new tab" affordance).
        if (!e.defaultPrevented) e.preventDefault();
      }}
    >
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
      <div
        className={cn(
          'flex items-center gap-1 px-3 pb-2 pt-3',
          collapsed ? 'flex-col' : 'justify-between',
        )}
      >
        <Link
          href="/app"
          // Stop bubbling so the parent `onContextMenu` guard never fires
          // here. This is the ONLY element in the sidebar that intentionally
          // shows the browser's native context menu (Open in new tab,
          // Copy link, etc.) — the user explicitly asked for it on the logo.
          onContextMenu={(e) => e.stopPropagation()}
          className="hover:bg-accent/40 flex items-center gap-2 rounded-md px-1 py-0.5 font-semibold tracking-tight transition-colors"
          aria-label="Notai home"
          title="Notai"
        >
          <span className="from-primary to-primary/70 text-primary-foreground shadow-primary/30 grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-sm">
            <PenLine className="size-3.5" />
          </span>
          {!collapsed && <span className="font-serif text-base">Notai</span>}
        </Link>
        <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
          {!collapsed && (
            <>
              <NotificationBell />
              <OpenStickiesButton variant="icon" />
              <ThemeToggle />
            </>
          )}
          {/* Mobile-only close button */}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            title="Close"
          >
            <X />
          </Button>
          {/* Desktop-only collapse toggle */}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="hidden md:inline-flex"
            onClick={toggleDesktop}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar (⌘\\)' : 'Collapse sidebar (⌘\\)'}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
      </div>

      <AppVersion collapsed={collapsed} />

      {/* Search trigger */}
      <div className={cn('pb-3', collapsed ? 'px-2' : 'px-3')}>
        {collapsed ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="bg-background/60 hover:bg-accent/60 mx-auto flex size-9"
            onClick={() => document.dispatchEvent(new CustomEvent('notai:command-palette'))}
            aria-label="Search (⌘K)"
            title="Search (⌘K)"
          >
            <Search />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="bg-background/60 text-muted-foreground hover:bg-accent/60 w-full justify-start"
            onClick={() => document.dispatchEvent(new CustomEvent('notai:command-palette'))}
          >
            <Search /> Search…
            <kbd className="bg-card text-foreground/60 ml-auto rounded border px-1 font-mono text-[10px]">
              ⌘K
            </kbd>
          </Button>
        )}
      </div>

      {/* Top nav */}
      <nav className={cn('space-y-0.5', collapsed ? 'px-2' : 'px-2')}>
        <NavItem
          href="/app"
          icon={<Home />}
          label="Today"
          active={pathname === '/app'}
          collapsed={collapsed}
        />
        <NavItem
          href="/app/today"
          icon={<CalendarDays />}
          label="Daily Note"
          active={pathname === '/app/today'}
          collapsed={collapsed}
        />
        <NavItem
          href="/app/ask"
          icon={<Sparkles />}
          label="Ask Notai"
          active={pathname === '/app/ask'}
          collapsed={collapsed}
        />
        <NavItem
          href="/app/graph"
          icon={<Network />}
          label="Graph"
          active={pathname === '/app/graph'}
          collapsed={collapsed}
        />
        <NavItem
          href="/app?filter=favorites"
          icon={<Star />}
          label="Favorites"
          collapsed={collapsed}
        />
        <NavItem
          href="/app?filter=archived"
          icon={<Archive />}
          label="Archived"
          collapsed={collapsed}
        />
      </nav>

      {/* Folder + note tree (consumes leftover space). Hidden in the icon
          rail since notes need their full title to be useful. The user
          can expand the rail (or use ⌘K search) to find a specific note. */}
      {!collapsed && <SidebarTree folders={folders} notes={notes} />}
      {collapsed && <div className="flex-1" />}

      {/* Desktop promo (auto-hides inside Tauri) */}
      {!collapsed && (
        <div className="px-2 py-1.5">
          <DesktopAppPromo collapsed={false} />
        </div>
      )}

      {/* Account */}
      <div className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'hover:bg-accent flex w-full items-center rounded-lg border text-left text-sm transition-colors',
                collapsed ? 'justify-center p-1.5' : 'gap-2 p-2.5',
              )}
              aria-label="Account menu"
              title={user.name ?? user.email ?? 'Account'}
            >
              <Avatar className="size-7">
                {user.image && <AvatarImage src={user.image} alt={user.name ?? 'user'} />}
                <AvatarFallback className="from-primary/30 to-primary/10 text-foreground/80 bg-gradient-to-br text-[10px] font-medium">
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {user.name ?? user.email ?? 'Anon'}
                  </div>
                  <div className="text-muted-foreground truncate text-[10px]">
                    {isAdmin ? 'Super admin' : (user.email ?? 'Account')}
                  </div>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="truncate text-sm font-medium">{user.name ?? 'Anon'}</p>
                {user.email && (
                  <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
              <Settings /> Settings
            </DropdownMenuItem>
            {isAdmin ? (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <Shield /> Admin
                </Link>
              </DropdownMenuItem>
            ) : null}
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
  collapsed,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'text-foreground/80 hover:bg-accent hover:text-accent-foreground group flex items-center rounded-md text-sm transition-colors [&_svg]:size-4',
        collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-2 py-1.5',
        active &&
          'bg-accent text-accent-foreground ring-primary/15 [&_svg]:text-primary shadow-sm ring-1',
      )}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
