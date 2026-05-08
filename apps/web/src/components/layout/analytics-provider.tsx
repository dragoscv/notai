'use client';
import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { posthog } from '@/lib/posthog-client';

/**
 * Tracks SPA pageviews + identifies the signed-in user. Mounted once near
 * the root of the authenticated layout. No-op when PostHog isn't configured.
 */
export function AnalyticsProvider({
  user,
  children,
}: {
  user: { id: string; email?: string | null; name?: string | null } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();

  React.useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const url = pathname + (search?.toString() ? `?${search.toString()}` : '');
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, search]);

  React.useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (user?.id) {
      posthog.identify(user.id, {
        email: user.email ?? undefined,
        name: user.name ?? undefined,
      });
    }
  }, [user?.id, user?.email, user?.name]);

  return <>{children}</>;
}
