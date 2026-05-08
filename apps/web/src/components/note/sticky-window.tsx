'use client';
import * as React from 'react';
import { X, Pin } from 'lucide-react';
import { CanvasNote, useNoteDoc, useSharedTitle, useRegisterOpenSticky } from '@notai/editor';
import { Button } from '@notai/ui/components/button';
import { cn } from '@notai/lib/utils';
import type { Note } from '@notai/db/schema';
import { updateNote } from '@/server/actions/notes';
import { SurfaceSwitcher, useSurface } from './surface-switcher';
import { isTauri, invoke } from '@/lib/tauri';

export interface StickyWindowProps {
  note: Note;
  token: string;
  realtimeUrl: string;
  user: { id: string; name: string };
}

/**
 * Compact sticky-note view. Uses an independent paper style from the main
 * window (localStorage key `notai:surface:sticky`) while sharing the same
 * Y.Doc so text/drawings/title stay in real-time sync.
 */
export function StickyWindow({ note, token, realtimeUrl, user }: StickyWindowProps) {
  const { doc, provider } = useNoteDoc({ noteId: note.id, url: realtimeUrl, token });
  const [title, setTitle] = useSharedTitle(doc, note.title);
  const [surface, setSurface] = useSurface('notai:surface:sticky');

  // Broadcast "I am an open sticky" to any main-window / sidebar listeners.
  useRegisterOpenSticky(note.id, title || note.title || 'Untitled');

  React.useEffect(() => {
    if (title === note.title) return;
    const h = setTimeout(() => updateNote({ id: note.id, title: title || 'Untitled' }), 600);
    return () => clearTimeout(h);
  }, [title, note.id, note.title]);

  // Keep the window/tab title in sync: "Title - Notai"
  React.useEffect(() => {
    document.title = `${title || 'Untitled'} - Notai`;
  }, [title]);

  const palette = (note.color && COLORS[note.color]) || COLORS.default!;
  const surfaceDataAttr = surface.surface;
  const surfaceStyle = { '--paper-spacing': `${surface.spacing}px` } as React.CSSProperties;
  const fullBg = surface.coverage === 'full';

  return (
    <div
      className={cn('flex h-dvh w-dvw flex-col overflow-hidden', 'shadow-xl ring-1 ring-black/5')}
      style={{ background: palette.bg, color: palette.fg }}
    >
      {/* Tauri drag region: `data-tauri-drag-region` makes the whole bar draggable in the desktop app */}
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-center gap-1 px-2 py-1.5 text-xs opacity-90"
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sticky"
          className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:opacity-50"
          data-tauri-drag-region="false"
        />
        <div data-tauri-drag-region="false" className="flex items-center">
          <SurfaceSwitcher value={surface} onChange={setSurface} />
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          className="size-6 hover:bg-black/10"
          onClick={async () => {
            await updateNote({ id: note.id, isPinned: !note.isPinned });
          }}
          title={note.isPinned ? 'Unpin' : 'Pin always-on-top (desktop)'}
        >
          <Pin className={cn('size-3', note.isPinned && 'fill-current')} />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="size-6 hover:bg-black/10"
          onClick={() => closeStickyWindow()}
        >
          <X className="size-3" />
        </Button>
      </header>

      {/* Color swatches */}
      <div className="flex gap-1 px-2 pb-1">
        {Object.keys(COLORS).map((c) => (
          <button
            key={c}
            aria-label={c}
            onClick={() => updateNote({ id: note.id, color: c })}
            className={cn(
              'size-3 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110',
              note.color === c && 'ring-2 ring-black/40',
            )}
            style={{ background: COLORS[c]!.bg }}
          />
        ))}
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        data-surface={fullBg ? surfaceDataAttr : undefined}
        style={fullBg ? surfaceStyle : undefined}
      >
        {doc && provider ? (
          <CanvasNote
            doc={doc}
            provider={provider}
            user={{ name: user.name, color: '#333' }}
            readOnly
            stickyMode
            surface={fullBg ? undefined : surface.surface}
            surfaceSpacing={surface.spacing}
            viewportKey={`notai:viewport:sticky:${note.id}`}
          />
        ) : (
          <div className="p-3 text-xs opacity-60">Connecting…</div>
        )}
      </div>
    </div>
  );
}

/**
 * Close the current sticky. In the Tauri desktop app `window.close()`
 * doesn't close webview windows spawned by the Rust host, so we call the
 * `close_sticky` command; in a browser popup `window.close()` works.
 */
async function closeStickyWindow() {
  if (isTauri()) {
    try {
      await invoke('close_sticky');
      return;
    } catch {
      /* fall through */
    }
  }
  window.close();
}

const COLORS: Record<string, { bg: string; fg: string }> = {
  default: { bg: 'var(--sticky-yellow)', fg: 'var(--sticky-fg)' },
  pink: { bg: 'var(--sticky-pink)', fg: 'var(--sticky-fg)' },
  blue: { bg: 'var(--sticky-blue)', fg: 'var(--sticky-fg)' },
  green: { bg: 'var(--sticky-green)', fg: 'var(--sticky-fg)' },
  purple: { bg: 'var(--sticky-purple)', fg: 'var(--sticky-fg)' },
  orange: { bg: 'var(--sticky-orange)', fg: 'var(--sticky-fg)' },
  black: { bg: 'var(--sticky-black)', fg: 'var(--sticky-black-fg)' },
};
