import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { countUnfiled } from '@/server/actions/inbox-zero';

const THRESHOLD = 5;

export async function InboxZeroNudge() {
  const count = await countUnfiled();
  if (count < THRESHOLD) return null;
  const t = await getTranslations('dashboard.inboxZeroNudge');

  return (
    <Link
      href="/app/inbox-zero"
      className="bg-card hover:border-primary/50 my-3 flex items-center gap-3 rounded-lg border p-4 shadow-sm transition-colors"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-amber-500/15 text-amber-600">
        <Inbox className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {count === 1 ? t('titleOne', { count }) : t('titleOther', { count })}
        </span>
        <span className="text-muted-foreground block text-xs">{t('body')}</span>
      </span>
      <span className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs font-medium">
        {t('cta')}
      </span>
    </Link>
  );
}
