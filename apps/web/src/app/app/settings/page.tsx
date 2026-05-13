import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  Bell,
  CreditCard,
  KeyRound,
  Plug,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Upload,
  Webhook,
} from 'lucide-react';
import { auth } from '@/auth';

export async function generateMetadata() {
  const t = await getTranslations('settings.pages.index');
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';

const SECTIONS = [
  { href: '/app/settings/security', icon: ShieldCheck, key: 'security' },
  { href: '/app/settings/notifications', icon: Bell, key: 'notifications' },
  { href: '/app/settings/billing', icon: CreditCard, key: 'billing' },
  { href: '/app/settings/ai-providers', icon: Sparkles, key: 'aiProviders' },
  { href: '/app/settings/integrations', icon: Plug, key: 'integrations' },
  { href: '/app/settings/connected-apps', icon: Puzzle, key: 'connectedApps' },
  { href: '/app/settings/api-keys', icon: KeyRound, key: 'apiKeys' },
  { href: '/app/settings/webhooks', icon: Webhook, key: 'webhooks' },
  { href: '/app/settings/import', icon: Upload, key: 'import' },
] as const;

export default async function SettingsIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings');
  const t = await getTranslations('settings.pages.index');

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('heading')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('intro')}</p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(({ href, icon: Icon, key }) => (
          <li key={href}>
            <Link
              href={href}
              className="border-border/60 bg-card hover:border-foreground/30 hover:bg-accent/40 group flex items-start gap-3 rounded-lg border p-4 transition-colors"
            >
              <span className="bg-muted text-foreground/80 group-hover:text-foreground mt-0.5 grid size-8 shrink-0 place-items-center rounded-md">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t(`${key}Label`)}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                  {t(key)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
