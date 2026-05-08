'use client';
import * as React from 'react';
import { Pin, Star, MoreHorizontal, PanelRight, WifiOff } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import {
  CanvasNote,
  Toolbar,
  useNoteDoc,
  useSharedTitle,
  type CanvasNoteHandle,
} from '@notai/editor';
import { Button } from '@notai/ui/components/button';
import { Avatar, AvatarFallback, AvatarImage } from '@notai/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@notai/ui/components/dropdown-menu';
import { Spinner } from '@notai/ui/components/spinner';
import { cn, getInitials } from '@notai/lib/utils';
import type { Note } from '@notai/db/schema';
import { updateNote, deleteNote } from '@/server/actions/notes';
import { toast } from 'sonner';
import { SurfaceSwitcher, useSurface } from './surface-switcher';
import { OpenStickiesButton } from './open-stickies-button';
import { isTauri, invoke } from '@/lib/tauri';
import { ShareDialog } from './share-dialog';
import { AssetUploader } from './asset-uploader';
import { BacklinksPanel } from './backlinks-panel';
import { TagChips } from './tag-chips';
import { VoiceRecorder } from './voice-recorder';
import { NoteAiMenu } from './note-ai-menu';
import { VersionHistory } from './version-history';
import { searchBacklinkCandidates } from '@/server/actions/backlinks';
import { useRouter } from 'next/navigation';

function colorFor(id: string) {
  const colors = [
    '#e11d48',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#06b6d4',
    '#6366f1',
    '#a855f7',
    '#ec4899',
  ];
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length]!;
}

export interface NoteWorkspaceProps {
  note: Note;
  token: string;
  realtimeUrl: string;
  user: { id: string; name: string; email: string; image: string | null };
}

export function NoteWorkspace({ note, token, realtimeUrl, user }: NoteWorkspaceProps) {
  const { doc, provider, status, synced } = useNoteDoc({
    noteId: note.id,
    url: realtimeUrl,
    token,
  });
  const router = useRouter();

  const [title, setTitle] = useSharedTitle(doc, note.title);
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const canvasRef = React.useRef<CanvasNoteHandle>(null);
  const [surface, setSurface] = useSurface();

  // Subscribe to focused-block editor changes so the toolbar always targets
  // the active text block on the canvas.
  React.useEffect(() => {
    const handle = canvasRef.current;
    if (!handle) return;
    return handle.subscribeFocused(setEditor);
  }, [doc]);

  const insertContent = React.useCallback((md: string | Record<string, unknown>) => {
    const handle = canvasRef.current;
    if (!handle) return;
    if (!handle.insertContent(md)) {
      handle.addTextBlock();
      // After block creation, retry on next tick once it has focus.
      setTimeout(() => handle.insertContent(md), 50);
    }
  }, []);

  React.useEffect(() => {
    if (title === note.title) return;
    const h = setTimeout(() => {
      updateNote({ id: note.id, title: title || 'Untitled' }).catch(() =>
        toast.error('Failed to save title'),
      );
    }, 600);
    return () => clearTimeout(h);
  }, [title, note.id, note.title]);

  // Keep the window/tab title in sync: "Title - Notai"
  React.useEffect(() => {
    document.title = `${title || 'Untitled'} - Notai`;
  }, [title]);

  // Surface is applied either to the full page background or only to the
  // inner editor column, depending on the coverage setting.
  const surfaceDataAttr = surface.surface;
  const surfaceStyle = { '--paper-spacing': `${surface.spacing}px` } as React.CSSProperties;
  const fullBg = surface.coverage === 'full';

  return (
    <div className="flex h-full flex-col">
      <header className="bg-background/70 flex shrink-0 items-center gap-2 border-b px-4 py-2 backdrop-blur">
        <ConnectionPill status={status} synced={synced} />

        <div className="bg-border mx-2 h-5 w-px" />

        <SurfaceSwitcher value={surface} onChange={setSurface} />

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={async () => {
              await updateNote({ id: note.id, isPinned: !note.isPinned });
              toast.success(note.isPinned ? 'Unpinned' : 'Pinned');
            }}
            aria-label="Pin"
            title={note.isPinned ? 'Unpin' : 'Pin to top'}
          >
            <Pin className={cn(note.isPinned && 'text-primary fill-current')} />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={async () => {
              await updateNote({ id: note.id, isFavorite: !note.isFavorite });
            }}
            aria-label="Favorite"
            title={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={cn(note.isFavorite && 'fill-yellow-500 text-yellow-500')} />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => openStickyWindow(note.id)}
            aria-label="Open as sticky window"
            title="Open as sticky window"
          >
            <PanelRight />
          </Button>

          <OpenStickiesButton />

          <ShareDialog noteId={note.id} ownerId={note.ownerId} currentUserId={user.id} />
          <AssetUploader
            noteId={note.id}
            onUploaded={({ url, mime }) => {
              if (mime.startsWith('image/')) {
                insertContent({ type: 'image', attrs: { src: url } });
              }
            }}
          />
          <VoiceRecorder
            onTranscribed={(text) => {
              insertContent(`\n\n${text}\n\n`);
              toast.success('Transcribed');
            }}
          />
          <NoteAiMenu noteId={note.id} onInsert={insertContent} />
          <VersionHistory noteId={note.id} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={async () => {
                  if (confirm('Delete this note?')) {
                    await deleteNote(note.id);
                    window.location.href = '/app';
                  }
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Avatar className="ring-card ml-2 size-7 ring-2">
            {user.image && <AvatarImage src={user.image} />}
            <AvatarFallback className="from-primary/30 to-primary/10 text-foreground/80 bg-gradient-to-br text-[10px] font-medium">
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        data-surface={fullBg ? surfaceDataAttr : undefined}
        style={fullBg ? surfaceStyle : undefined}
      >
        {!doc || !provider ? (
          <div className="text-muted-foreground grid flex-1 place-items-center text-sm">
            <Spinner /> Connecting…
          </div>
        ) : (
          <>
            <div className="editor-column mx-auto w-full px-8 pt-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled"
                className="placeholder:text-muted-foreground w-full bg-transparent font-serif text-3xl font-semibold tracking-tight outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <TagChips noteId={note.id} />
              </div>
              {editor && (
                <div className="bg-background/80 sticky top-0 z-10 mt-2 py-1.5 backdrop-blur">
                  <Toolbar editor={editor} />
                </div>
              )}
            </div>
            <div
              className="relative min-h-0 flex-1"
              onClickCapture={(e) => {
                const target = (e.target as HTMLElement).closest('a[data-backlink]');
                if (!target) return;
                const id = target.getAttribute('data-backlink');
                if (!id) return;
                e.preventDefault();
                router.push(`/app/n/${id}`);
              }}
            >
              {/* In "page" coverage, the surface is a centred paper sheet
                  matching the editor column width with the rest of the
                  canvas left blank. In "full" coverage, the parent above
                  carries the surface and this inner wrapper is just a
                  positioning context for CanvasNote. */}
              {!fullBg && (
                <div
                  aria-hidden
                  className="editor-column pointer-events-none absolute inset-y-0 left-1/2 w-full -translate-x-1/2"
                  data-surface={surfaceDataAttr}
                  style={surfaceStyle}
                />
              )}
              <CanvasNote
                ref={canvasRef}
                doc={doc}
                provider={provider}
                user={{ name: user.name, color: colorFor(user.id) }}
                searchBacklinks={searchBacklinkCandidates}
                viewportKey={`notai:viewport:${note.id}`}
              />
            </div>
            <BacklinksPanel noteId={note.id} />
          </>
        )}
      </div>
    </div>
  );
}

function ConnectionPill({
  status,
  synced,
}: {
  status: 'connecting' | 'connected' | 'disconnected';
  synced: boolean;
}) {
  const online = status === 'connected' && synced;
  const connecting = status === 'connecting';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] backdrop-blur',
        online && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        connecting && 'border-primary/30 bg-primary/10 text-primary',
        !online && !connecting && 'border-muted-foreground/20 bg-muted text-muted-foreground',
      )}
    >
      {online ? (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <WifiOff className="size-3" />
      )}
      {online ? 'Synced' : connecting ? 'Connecting' : 'Offline'}
    </span>
  );
}

/**
 * Open a note as a sticky-note window.
 *
 * In the Tauri desktop app this invokes the native `open_sticky` command
 * which spawns an always-on-top borderless WebviewWindow. In the browser
 * it falls back to a regular popup.
 */
async function openStickyWindow(noteId: string) {
  if (isTauri()) {
    try {
      await invoke('open_sticky', { noteId });
      return;
    } catch (err) {
      if (String(err) !== 'Error: not-in-tauri') {
        toast.error(`Couldn't open sticky window: ${String(err)}`);
        return;
      }
    }
  }
  window.open(`/sticky/${noteId}`, '_blank', 'popup=yes,width=360,height=480');
}
