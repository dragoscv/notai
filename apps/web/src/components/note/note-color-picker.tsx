'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Palette } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@notai/ui/components/popover';
import { updateNote } from '@/server/actions/notes';

interface ColorOption {
  id: string;
  labelKey: string;
  swatch: string;
}

const COLOURS: ColorOption[] = [
  { id: '', labelKey: 'noTint', swatch: 'transparent' },
  { id: 'amber', labelKey: 'amber', swatch: '#fde68a' },
  { id: 'rose', labelKey: 'rose', swatch: '#fecdd3' },
  { id: 'sky', labelKey: 'sky', swatch: '#bae6fd' },
  { id: 'emerald', labelKey: 'emerald', swatch: '#a7f3d0' },
  { id: 'violet', labelKey: 'violet', swatch: '#ddd6fe' },
  { id: 'slate', labelKey: 'slate', swatch: '#cbd5e1' },
];

/**
 * Compact swatch picker for the per-note color label. Stores the
 * value in `notes.color` (already a string column) so the same tint
 * can drive both the sidebar dot and any future tinted-canvas mode.
 */
export function NoteColorPicker({
  noteId,
  currentColor,
}: {
  noteId: string;
  currentColor: string | null | undefined;
}) {
  const t = useTranslations('editor.colors');
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const current = COLOURS.find((c) => c.id === (currentColor ?? '')) ?? COLOURS[0]!;

  const pick = async (id: string) => {
    setBusy(true);
    try {
      await updateNote({ id: noteId, color: id });
      const matched = COLOURS.find((c) => c.id === id);
      toast.success(id && matched ? t('tagged', { label: t(matched.labelKey) }) : t('cleared'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('aria')}
          title={t('title', { label: t(current.labelKey) })}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs"
          disabled={busy}
        >
          {current.id ? (
            <span className="size-3 rounded-full" style={{ background: current.swatch }} />
          ) : (
            <Palette className="size-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1.5">
        <div className="text-muted-foreground px-1.5 pb-1 text-[10px] uppercase tracking-widest">
          {t('heading')}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {COLOURS.map((c) => (
            <button
              key={c.id || 'none'}
              type="button"
              onClick={() => pick(c.id)}
              aria-label={t(c.labelKey)}
              title={t(c.labelKey)}
              className={
                'hover:ring-primary grid size-6 place-items-center rounded-full ring-1 ring-transparent transition' +
                (c.id === current.id ? ' ring-primary' : ' ring-border')
              }
              style={{
                background:
                  c.swatch === 'transparent'
                    ? 'repeating-linear-gradient(45deg,#0001 0 4px,transparent 4px 8px)'
                    : c.swatch,
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
