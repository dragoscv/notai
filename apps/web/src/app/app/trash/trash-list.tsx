'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { emptyTrash, purgeNote, restoreNote } from '@/server/actions/notes';

export interface TrashItem {
  id: string;
  title: string;
  icon: string | null;
  deletedAt: string;
  plaintext: string;
}

export function TrashList({ items: initial }: { items: TrashItem[] }) {
  const t = useTranslations('pages.trash');
  const [items, setItems] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="bg-card grid place-items-center rounded-2xl border px-6 py-16 text-center">
        <Trash2 className="text-muted-foreground/40 mb-3 size-10" />
        <p className="font-serif text-xl">{t('emptyTitle')}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t('emptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={pending}
          onClick={() => {
            if (!confirm(t('emptyTrashConfirm'))) return;
            startTransition(async () => {
              await emptyTrash();
              setItems([]);
              router.refresh();
            });
          }}
        >
          {t('emptyTrashButton')}
        </Button>
      </div>
      <ul className="bg-card divide-border divide-y rounded-2xl border">
        {items.map((n) => {
          const days = daysSince(n.deletedAt);
          const remaining = Math.max(0, 30 - days);
          const when =
            days === 0
              ? t('deletedToday')
              : days === 1
                ? t('deletedDaysAgoOne', { count: days })
                : t('deletedDaysAgoOther', { count: days });
          const purge =
            remaining === 1
              ? t('purgesInOne', { count: remaining })
              : t('purgesInOther', { count: remaining });
          return (
            <li key={n.id} className="flex items-center gap-3 px-4 py-3">
              <span className="bg-muted/70 grid size-9 shrink-0 place-items-center rounded-md text-base">
                {n.icon ?? <FileText className="text-muted-foreground size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif">{n.title || t('untitled')}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {t('deletedLine', { when, purge })}
                  {n.plaintext && ` · ${n.plaintext.slice(0, 80)}…`}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await restoreNote(n.id);
                    setItems((arr) => arr.filter((x) => x.id !== n.id));
                    toast.success(t('restored'));
                  })
                }
              >
                <RotateCcw className="size-3.5" />
                {t('restore')}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t('deleteForeverLabel')}
                disabled={pending}
                onClick={() => {
                  if (!confirm(t('deleteConfirm'))) return;
                  startTransition(async () => {
                    await purgeNote(n.id);
                    setItems((arr) => arr.filter((x) => x.id !== n.id));
                  });
                }}
              >
                <Trash2 className="text-destructive size-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
