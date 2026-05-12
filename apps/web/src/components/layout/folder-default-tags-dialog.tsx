'use client';

import * as React from 'react';
import { Hash } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@notai/ui/components/dialog';
import { Button } from '@notai/ui/components/button';
import { listTags } from '@/server/actions/tags';
import { getFolderDefaultTags, setFolderDefaultTags } from '@/server/actions/folders';

interface Tag {
  id: string;
  name: string;
}

/**
 * Folder context-menu dialog: pick which tags to auto-attach to every
 * note created in this folder. Multi-select chips, Save/Cancel.
 */
export function FolderDefaultTagsDialog({
  folderId,
  folderName,
  open,
  onOpenChange,
}: {
  folderId: string;
  folderName: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [allTags, setAllTags] = React.useState<Tag[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const t = useTranslations('sidebarTree.folderDefaultTags');

  React.useEffect(() => {
    if (!open) return;
    void Promise.all([listTags(), getFolderDefaultTags(folderId)]).then(([tags, defaults]) => {
      setAllTags(tags.map((t) => ({ id: t.id, name: t.name })));
      setSelected(new Set(defaults));
    });
  }, [open, folderId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      await setFolderDefaultTags({ id: folderId, tagIds: Array.from(selected) });
      toast.success(t('saved'));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('titlePrefix')}&ldquo;{folderName}&rdquo;
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        {allTags.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">{t('empty')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 py-2">
            {allTags.map((tag) => {
              const on = selected.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggle(tag.id)}
                  className={
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ' +
                    (on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent')
                  }
                  aria-pressed={on}
                >
                  <Hash className="size-3 opacity-60" />
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            {t('save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
