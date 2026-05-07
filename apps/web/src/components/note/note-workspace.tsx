'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import {
    Pin,
    Star,
    MoreHorizontal,
    PanelRight,
    PenLine,
    Wifi,
    WifiOff,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { NoteEditor, Toolbar, useNoteDoc, useSharedTitle } from '@notai/editor';
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

// Drawing canvas uses browser-only APIs (tldraw). Load lazily on the client.
const DrawingCanvas = dynamic(
    () => import('@notai/editor').then((m) => ({ default: m.DrawingCanvas })),
    { ssr: false, loading: () => null },
);

function colorFor(id: string) {
    const colors = ['#e11d48', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#ec4899'];
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

    const [title, setTitle] = useSharedTitle(doc, note.title);
    const [editor, setEditor] = React.useState<Editor | null>(null);
    const [drawing, setDrawing] = React.useState(false);
    const [surface, setSurface] = useSurface();

    React.useEffect(() => {
        if (title === note.title) return;
        const h = setTimeout(() => {
            updateNote({ id: note.id, title: title || 'Untitled' }).catch(() => toast.error('Failed to save title'));
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
            <header className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
                <Button
                    size="sm"
                    variant={drawing ? 'secondary' : 'ghost'}
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => setDrawing((v) => !v)}
                    title="Toggle draw mode"
                >
                    <PenLine className="size-3.5" />
                    {drawing ? 'Drawing' : 'Draw'}
                </Button>

                <div className="mx-2 h-5 w-px bg-border" />

                <ConnectionPill status={status} synced={synced} />

                <div className="mx-2 h-5 w-px bg-border" />

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
                    >
                        <Pin className={cn(note.isPinned && 'fill-current')} />
                    </Button>
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={async () => {
                            await updateNote({ id: note.id, isFavorite: !note.isFavorite });
                        }}
                        aria-label="Favorite"
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

                    <Avatar className="ml-2 size-7">
                        {user.image && <AvatarImage src={user.image} />}
                        <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                    </Avatar>
                </div>
            </header>

            <div
                className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
                data-surface={fullBg ? surfaceDataAttr : undefined}
                style={fullBg ? surfaceStyle : undefined}
            >
                {!doc || !provider ? (
                    <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
                        <Spinner /> Connecting…
                    </div>
                ) : (
                    <>
                        {/* Text layer — always rendered, becomes inert in draw mode */}
                        <div
                            className={cn(
                                'flex min-h-0 flex-1 flex-col',
                                drawing && 'pointer-events-none select-none',
                            )}
                            aria-hidden={drawing}
                        >
                            <div className="editor-column mx-auto w-full px-8 pt-10">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Untitled"
                                    className="w-full bg-transparent font-serif text-4xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
                                />
                            </div>

                            <div
                                className="editor-column mx-auto mt-4 flex w-full flex-1 flex-col overflow-y-auto"
                                style={{ scrollbarGutter: 'stable' }}
                            >
                                <div className="sticky top-0 z-10 mx-8 bg-background/80 py-2 backdrop-blur">
                                    <Toolbar editor={editor} />
                                </div>
                                <div
                                    data-surface={fullBg ? undefined : surfaceDataAttr}
                                    style={fullBg ? undefined : surfaceStyle}
                                    className="flex-1"
                                >
                                    <NoteEditor
                                        doc={doc}
                                        provider={provider}
                                        user={{ name: user.name, color: colorFor(user.id) }}
                                        onReady={setEditor}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Drawing overlay — always visible. When not drawing, it's click-through
             * so the text editor below stays interactive. When drawing, pointer
             * events go to the canvas. */}
                        <div className={cn('absolute inset-0', !drawing && 'pointer-events-none')}>
                            <DrawingCanvas
                                doc={doc}
                                interactive={drawing}
                                hideUi={!drawing}
                                transparent
                            />
                        </div>
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
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]',
                online
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-muted-foreground/20 bg-muted text-muted-foreground',
            )}
        >
            {online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {online ? 'Synced' : status === 'connecting' ? 'Connecting' : 'Offline'}
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
