'use client';

import * as React from 'react';
import { Hash } from 'lucide-react';
import { toast } from 'sonner';
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
      toast.success('Default tags saved.');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Default tags for &ldquo;{folderName}&rdquo;</DialogTitle>
          <DialogDescription>
            Any note you create in this folder will be auto-tagged with the tags you pick below.
          </DialogDescription>
        </DialogHeader>
        {allTags.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            You don&rsquo;t have any tags yet. Tag a note first, then come back.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 py-2">
            {allTags.map((t) => {
              const on = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ' +
                    (on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent')
                  }
                  aria-pressed={on}
                >
                  <Hash className="size-3 opacity-60" />
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
