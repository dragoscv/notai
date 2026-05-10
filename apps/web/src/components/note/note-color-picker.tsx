'use client';

import * as React from 'react';
import { Palette } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@notai/ui/components/popover';
import { updateNote } from '@/server/actions/notes';

interface ColorOption {
  id: string;
  label: string;
  swatch: string;
}

const COLOURS: ColorOption[] = [
  { id: '', label: 'No tint', swatch: 'transparent' },
  { id: 'amber', label: 'Amber', swatch: '#fde68a' },
  { id: 'rose', label: 'Rose', swatch: '#fecdd3' },
  { id: 'sky', label: 'Sky', swatch: '#bae6fd' },
  { id: 'emerald', label: 'Emerald', swatch: '#a7f3d0' },
  { id: 'violet', label: 'Violet', swatch: '#ddd6fe' },
  { id: 'slate', label: 'Slate', swatch: '#cbd5e1' },
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
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const current = COLOURS.find((c) => c.id === (currentColor ?? '')) ?? COLOURS[0]!;

  const pick = async (id: string) => {
    setBusy(true);
    try {
      await updateNote({ id: noteId, color: id });
      toast.success(id ? `Tagged as ${id}` : 'Cleared color');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save color');
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
          aria-label="Pick a color label"
          title={`Color: ${current.label}`}
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
          Color label
        </div>
        <div className="grid grid-cols-7 gap-1">
          {COLOURS.map((c) => (
            <button
              key={c.id || 'none'}
              type="button"
              onClick={() => pick(c.id)}
              aria-label={c.label}
              title={c.label}
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
