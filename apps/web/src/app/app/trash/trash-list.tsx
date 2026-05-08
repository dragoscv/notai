'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
  const [items, setItems] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="bg-card grid place-items-center rounded-2xl border px-6 py-16 text-center">
        <Trash2 className="text-muted-foreground/40 mb-3 size-10" />
        <p className="font-serif text-xl">Trash is empty</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Deleted notes appear here for 30 days before being purged.
        </p>
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
            if (!confirm('Permanently delete every note in Trash? This cannot be undone.')) return;
            startTransition(async () => {
              await emptyTrash();
              setItems([]);
              router.refresh();
            });
          }}
        >
          Empty trash
        </Button>
      </div>
      <ul className="bg-card divide-border divide-y rounded-2xl border">
        {items.map((n) => {
          const days = daysSince(n.deletedAt);
          const remaining = Math.max(0, 30 - days);
          return (
            <li key={n.id} className="flex items-center gap-3 px-4 py-3">
              <span className="bg-muted/70 grid size-9 shrink-0 place-items-center rounded-md text-base">
                {n.icon ?? <FileText className="text-muted-foreground size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif">{n.title || 'Untitled'}</p>
                <p className="text-muted-foreground truncate text-xs">
                  Deleted {days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`} ·
                  purges in {remaining} day{remaining === 1 ? '' : 's'}
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
                    toast.success('Restored');
                  })
                }
              >
                <RotateCcw className="size-3.5" />
                Restore
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Delete forever"
                disabled={pending}
                onClick={() => {
                  if (!confirm('Permanently delete this note?')) return;
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
