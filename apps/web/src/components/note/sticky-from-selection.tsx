'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { StickyNote } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import type { CanvasNoteHandle } from '@notai/editor';
import { createNote } from '@/server/actions/notes';

interface SceneElement {
  id: string;
  type: string;
  text?: string;
  isDeleted?: boolean;
  y?: number;
}

interface ExApi {
  getSceneElements(): readonly SceneElement[];
  getAppState(): { selectedElementIds: Record<string, boolean> };
  onChange(cb: () => void): () => void;
}

/**
 * Floating action shown when the user has ≥1 text element selected on
 * the canvas. Clicking it spins up a brand-new note pre-populated with
 * the concatenated text (sorted top-to-bottom) using the existing
 * `notai:pending-append` handoff that note-workspace already drains.
 */
export function StickyFromSelection({
  canvasRef,
}: {
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
}) {
  const t = useTranslations('editor.stickies.fromSelection');
  const router = useRouter();
  const [text, setText] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const api = canvasRef.current?.getExcalidrawApi() as unknown as ExApi | null;
    if (!api) return;
    const sample = () => {
      const state = api.getAppState();
      const selected = state.selectedElementIds || {};
      const ids = Object.keys(selected).filter((id) => selected[id]);
      if (ids.length === 0) {
        setText('');
        return;
      }
      const all = api.getSceneElements();
      const picked = all
        .filter((el) => !el.isDeleted && el.type === 'text' && ids.includes(el.id))
        .slice()
        .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
      const joined = picked
        .map((el) => (el.text ?? '').trim())
        .filter(Boolean)
        .join('\n\n');
      setText(joined);
    };
    sample();
    const off = api.onChange(sample);
    return off;
  }, [canvasRef]);

  if (!text || busy) return null;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 3) return null;

  const onClick = async () => {
    setBusy(true);
    try {
      const created = await createNote({
        title: text.split('\n')[0]!.slice(0, 60) || t('defaultTitle'),
      });
      const noteId = created?.id;
      if (!noteId) throw new Error('Failed to create note');
      try {
        window.localStorage.setItem(
          'notai:pending-append',
          JSON.stringify({ noteId, text, ts: Date.now() }),
        );
      } catch {
        /* ignore */
      }
      router.push(`/app/n/${noteId}`);
    } catch (err) {
      console.error(err);
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-30">
      <Button
        type="button"
        size="sm"
        variant="default"
        onClick={onClick}
        className="pointer-events-auto shadow-lg"
      >
        <StickyNote className="size-3.5" /> {t('label', { count: wordCount })}
      </Button>
    </div>
  );
}
