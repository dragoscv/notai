'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@notai/lib/utils';

interface SidebarContextValue {
  /** Mobile drawer visibility (md and below). */
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  toggleMobile: () => void;
  /** Desktop icon-rail collapse. Persisted in localStorage. */
  desktopCollapsed: boolean;
  setDesktopCollapsed: (v: boolean) => void;
  toggleDesktop: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

const LS_COLLAPSED = 'notai:sidebar-collapsed';

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used inside <AppShell>');
  return ctx;
}

/**
 * Wraps the app chrome (sidebar + main pane) and provides responsive state:
 *  - Mobile: the sidebar becomes an off-canvas drawer controlled by `mobileOpen`
 *  - Desktop: the sidebar can collapse to a narrow icon rail via `desktopCollapsed`
 *
 * Keep this component minimal — the actual markup still lives in `<Sidebar>`
 * and page headers. We render a backdrop here so clicking outside dismisses
 * the mobile drawer without each consumer having to replicate that logic.
 */
export function AppShell({
  sidebar,
  children,
  commandPalette,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  commandPalette?: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopCollapsed, setDesktopCollapsedState] = React.useState(false);
  const t = useTranslations('appShell');

  // Hydrate desktop collapse state after mount to avoid SSR mismatch.
  React.useEffect(() => {
    try {
      setDesktopCollapsedState(window.localStorage.getItem(LS_COLLAPSED) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const setDesktopCollapsed = React.useCallback((v: boolean) => {
    setDesktopCollapsedState(v);
    try {
      window.localStorage.setItem(LS_COLLAPSED, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  // Close the mobile drawer on route changes / navigation (heuristic: any
  // click inside main content when the drawer is open).
  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      mobileOpen,
      setMobileOpen,
      toggleMobile: () => setMobileOpen(!mobileOpen),
      desktopCollapsed,
      setDesktopCollapsed,
      toggleDesktop: () => setDesktopCollapsed(!desktopCollapsed),
    }),
    [mobileOpen, desktopCollapsed, setDesktopCollapsed],
  );

  return (
    <SidebarContext.Provider value={value}>
      <a href="#app-main" className="a11y-skip-link">
        {t('skipToContent')}
      </a>
      <a href="#app-sidebar" className="a11y-skip-link" style={{ left: '10rem' }}>
        {t('skipToSidebar')}
      </a>
      <div
        className="bg-background flex h-dvh w-full overflow-hidden"
        onContextMenu={(e) => {
          // App-wide guard: suppress the native browser menu on any
          // shell chrome that doesn't have its own custom Radix
          // ContextMenu. Inner triggers (sidebar tree items, future
          // editor menus) call preventDefault during bubbling so they
          // still open their own menu first; this handler only fires
          // for the bare backdrop / panels / buttons we don't wire.
          if (!e.defaultPrevented) e.preventDefault();
        }}
      >
        {sidebar}

        {/* Mobile backdrop — only active when drawer open */}
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            'fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity md:hidden',
            mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          aria-hidden={!mobileOpen}
        />

        <main
          id="app-main"
          tabIndex={-1}
          className="relative flex min-w-0 flex-1 flex-col focus:outline-none"
        >
          {children}
        </main>
        {commandPalette}
      </div>
    </SidebarContext.Provider>
  );
}
