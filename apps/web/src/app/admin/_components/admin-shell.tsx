'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Tag,
  CreditCard,
  BarChart3,
  Sparkles,
  Megaphone,
  ScrollText,
  Activity,
  Ticket,
  ToggleRight,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@notai/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@notai/ui';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/plans', label: 'Plans', icon: Tag },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { href: '/admin/feature-flags', label: 'Feature flags', icon: ToggleRight },
  { href: '/admin/broadcasts', label: 'Broadcasts', icon: Megaphone },
  { href: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
  { href: '/admin/health', label: 'Health', icon: Activity },
];

export function AdminShell({
  user,
  children,
}: {
  user: { id: string; email: string | null; name: string | null; image: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const initial = (user.name ?? user.email ?? '?')[0]?.toUpperCase();
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="bg-grid-fade pointer-events-none fixed inset-0 -z-10 opacity-[0.04]" />
      <div className="from-primary/[0.06] pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br via-transparent to-transparent" />

      <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 py-6 md:px-8">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 flex-col md:flex">
          <Link
            href="/app"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1.5 text-xs font-medium transition"
          >
            <ArrowLeft className="size-3.5" />
            Back to app
          </Link>
          <div className="mb-6 flex items-center gap-2">
            <div className="from-primary to-primary/60 flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm">
              <Sparkles className="size-4" />
            </div>
            <div>
              <div className="font-serif text-sm font-semibold leading-none tracking-tight">
                Notai admin
              </div>
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Control plane
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : (pathname?.startsWith(item.href) ?? false);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                    active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="admin-nav-active"
                      className="bg-muted absolute inset-0 -z-10 rounded-lg"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  ) : null}
                  <Icon className="size-4 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex items-center gap-2 rounded-lg border p-2.5">
            <Avatar className="size-7">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{user.name ?? user.email}</div>
              <div className="text-muted-foreground truncate text-[10px]">Super admin</div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
