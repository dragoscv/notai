'use client';
import * as React from 'react';
import {
  Pin,
  Star,
  MoreHorizontal,
  PanelRight,
  WifiOff,
  MessageSquare,
  MessageCircle,
  Mic,
} from 'lucide-react';
import {
  CanvasNote,
  useNoteDoc,
  useSharedTitle,
  migrateBlocksToExcalidraw,
  appendTextToScene,
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
import { suggestEmojiForTitle } from '@/server/actions/suggest-emoji';
import { toast } from 'sonner';
import { SurfaceSwitcher, useSurface } from './surface-switcher';
import { NoteStatsChip } from './note-stats-chip';
import { OpenStickiesButton } from './open-stickies-button';
import { isTauri, invoke } from '@/lib/tauri';
import { ShareDialog } from './share-dialog';
import { AssetUploader } from './asset-uploader';
import { BacklinksPanel } from './backlinks-panel';
import { NoteMiniGraph } from './note-mini-graph';
import { NoteLinkPreviews } from './note-link-previews';
import { RelatedNotesRail } from './related-notes-rail';
import { RolloverBanner } from './rollover-banner';
import { CanvasMigrationBanner } from './canvas-migration-banner';
import { TagChips } from './tag-chips';
import { NoteStats } from './note-stats';
import { ReadingMode } from './reading-mode';
import { WordCountChip } from './word-count-chip';
import { NoteColorPicker } from './note-color-picker';
import { SmartLinkChip } from './smart-link-chip';
import { NoteCoverBanner } from './note-cover-banner';
import { NotePropertiesPanel } from './note-properties-panel';
import { RecurringRollBanner } from './recurring-roll-banner';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';
import { NoteLockOverlay } from './note-lock-overlay';
import { CanvasQuickMath } from './canvas-quick-math';
import { CanvasSnippets } from './canvas-snippets';
import { StickyFromSelection } from './sticky-from-selection';
import { VoiceRecorder } from './voice-recorder';
import { VoiceModeButton } from './voice-mode-button';
import { HoldToRecord } from './canvas-hold-to-record';
import { FocusModeOverlay } from './focus-mode-overlay';
import { NoteSearch } from './note-search';
import { BulletReorder } from './bullet-reorder';
import { runSlashAi } from '@/lib/slash-ai-client';
import { NoteChatPanel } from './note-chat-panel';
import { NoteCommentsPanel } from './note-comments-panel';
import { MeetingModePanel } from './meeting-mode-panel';
import type { CommentRow } from '@/server/actions/comments';
import { rewireCommentsAfterMigration } from '@/server/actions/comments';
import { summariseUrl, outlinePastedText } from '@/server/actions/smart-paste';
import { NoteAiMenu } from './note-ai-menu';
import { ApplyTemplateButton } from './apply-template-button';
import { VersionHistory } from './version-history';
import { searchBacklinkCandidates, createNoteFromBacklink } from '@/server/actions/backlinks';
import { FocusMode } from './focus-mode';
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
  const canvasRef = React.useRef<CanvasNoteHandle>(null);
  const [surface, setSurface] = useSurface();

  // Chat panel: open state is per-note + persisted to localStorage so
  // power users keep it open across reloads, while first-time visitors
  // see a clean canvas. SSR-safe via the lazy initializer.
  const chatStorageKey = `notai:chat-panel-open:${note.id}`;
  const [chatOpen, setChatOpen] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(chatStorageKey) === '1';
  });
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(chatStorageKey, chatOpen ? '1' : '0');
  }, [chatStorageKey, chatOpen]);

  // Comments panel: same persistence pattern as chat. Mutually exclusive
  // visually with chat (only one right rail at a time) but tracked
  // separately so toggling either restores the other later.
  const commentsStorageKey = `notai:comments-panel-open:${note.id}`;
  const [commentsOpen, setCommentsOpen] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(commentsStorageKey) === '1';
  });
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(commentsStorageKey, commentsOpen ? '1' : '0');
  }, [commentsStorageKey, commentsOpen]);
  const [pendingCommentAnchor, setPendingCommentAnchor] = React.useState<
    CommentRow['anchor'] | null
  >(null);
  const onCommentBlock = React.useCallback((blockId: string) => {
    setPendingCommentAnchor({ kind: 'block', blockId });
    setCommentsOpen(true);
    setChatOpen(false);
  }, []);

  // Meeting Mode panel: ambient capture + AI enhancement (Granola style).
  // Mutually exclusive with chat/comments at the right rail.
  const meetingStorageKey = `notai:meeting-panel-open:${note.id}`;
  const [meetingOpen, setMeetingOpen] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(meetingStorageKey) === '1';
  });
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(meetingStorageKey, meetingOpen ? '1' : '0');
  }, [meetingStorageKey, meetingOpen]);

  // Phase-3 step-3 retired the TipTap focus subscription. The toolbar
  // (and the focused-editor state that fed it) is gone; the canvas is
  // the only authoring surface.

  const insertContent = React.useCallback((md: string | Record<string, unknown>) => {
    const handle = canvasRef.current;
    if (!handle) return;
    // Phase-3 step-2: insertContent now drops content onto the
    // Excalidraw scene as a text element. No fallback path needed —
    // the handle returns false only when the canvas API isn't ready
    // yet, which the caller treats as a no-op.
    handle.insertContent(md);
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

  // Auto-suggest an emoji icon when the user has typed a real title and
  // hasn't picked an icon yet. One AI call per unique title; cached
  // locally so re-typing the same title doesn't re-fire.
  const emojiTriedRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (note.icon) return; // Respect any user-picked icon.
    const t = title.trim();
    if (t.length < 4 || t.toLowerCase() === 'untitled') return;
    if (emojiTriedRef.current.has(t)) return;
    const h = setTimeout(() => {
      emojiTriedRef.current.add(t);
      suggestEmojiForTitle(t)
        .then((emoji) => {
          if (!emoji) return;
          void updateNote({ id: note.id, icon: emoji }).catch(() => undefined);
        })
        .catch(() => undefined);
    }, 2500);
    return () => clearTimeout(h);
  }, [title, note.id, note.icon]);

  const togglePin = React.useCallback(async () => {
    await updateNote({ id: note.id, isPinned: !note.isPinned });
    toast.success(note.isPinned ? 'Unpinned' : 'Pinned');
  }, [note.id, note.isPinned]);
  useHotkey(
    'mod+shift+p',
    () => {
      void togglePin();
    },
    { id: 'pin-toggle' },
  );

  // Quick-Capture handoff: if the user clicked "Append to <this note>"
  // in the global capture overlay we stashed the payload in localStorage
  // and routed here. Replay it onto the live Excalidraw scene once the
  // doc has synced and the canvas API is ready, then clear the key.
  React.useEffect(() => {
    if (!synced) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const handle = canvasRef.current;
      const api = handle?.getExcalidrawApi();
      if (!api) {
        window.setTimeout(tick, 80);
        return;
      }
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem('notai:pending-append');
      } catch {
        return;
      }
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { noteId?: string; text?: string; ts?: number };
          if (parsed.noteId === note.id && parsed.text) {
            // Stale beyond 5 minutes: discard rather than surprising the user.
            if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts <= 5 * 60 * 1000) {
              appendTextToScene(api, parsed.text, { focus: true });
              toast.success('Appended captured note.');
            }
            window.localStorage.removeItem('notai:pending-append');
          }
        } catch {
          try {
            window.localStorage.removeItem('notai:pending-append');
          } catch {
            /* ignore */
          }
        }
      }

      // Drain the multi-target batch list. Each note picks up only its
      // own slice; the rest stays for whichever note we visit next.
      try {
        const listRaw = window.localStorage.getItem('notai:pending-appends');
        if (listRaw) {
          const list = JSON.parse(listRaw) as Array<{
            noteId?: string;
            text?: string;
            ts?: number;
          }>;
          if (Array.isArray(list)) {
            const mine = list.filter(
              (it) =>
                it &&
                it.noteId === note.id &&
                typeof it.text === 'string' &&
                it.text.length > 0 &&
                (typeof it.ts !== 'number' || Date.now() - it.ts <= 5 * 60 * 1000),
            );
            const rest = list.filter((it) => it && it.noteId !== note.id);
            if (mine.length > 0) {
              for (const it of mine) {
                if (it.text) appendTextToScene(api, it.text, { focus: false });
              }
              toast.success(
                mine.length === 1
                  ? 'Appended 1 captured note.'
                  : `Appended ${mine.length} captured notes.`,
              );
            }
            if (rest.length === 0) {
              window.localStorage.removeItem('notai:pending-appends');
            } else {
              window.localStorage.setItem('notai:pending-appends', JSON.stringify(rest));
            }
          }
        }
      } catch {
        try {
          window.localStorage.removeItem('notai:pending-appends');
        } catch {
          /* ignore */
        }
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [synced, note.id]);

  // Smart paste: when a single URL is pasted onto the canvas, fetch +
  // summarise it server-side and drop a captioned text card. Drops a
  // placeholder element first so the user gets immediate feedback,
  // then swaps the text once the summary lands.
  const handleUrlPaste = React.useCallback(async (url: string) => {
    const api = canvasRef.current?.getExcalidrawApi();
    if (!api) return;
    const placeholderId = appendTextToScene(api, `Summarising ${url}…`, {
      focus: true,
    });
    const toastId = toast.loading('Summarising the link…');
    try {
      const res = await summariseUrl({ url });
      const body = `${res.title}\n\n${res.summary}\n\n— ${res.host}\n${res.url}`;
      // Tombstone the placeholder by id, then drop the real card.
      if (placeholderId) {
        const elements = api.getSceneElements();
        const next = elements.map((el) =>
          el.id === placeholderId ? { ...el, isDeleted: true, updated: Date.now() } : el,
        );
        api.updateScene({ elements: next });
      }
      appendTextToScene(api, body, { focus: true });
      toast.success('Summary added.', { id: toastId });
    } catch (err) {
      if (placeholderId) {
        const elements = api.getSceneElements();
        const next = elements.map((el) =>
          el.id === placeholderId ? { ...el, isDeleted: true, updated: Date.now() } : el,
        );
        api.updateScene({ elements: next });
      }
      toast.error((err as Error).message || 'Smart paste failed', { id: toastId });
    }
  }, []);

  // Smart paste — long text variant. When >= 500 chars of plain text
  // hit the canvas, give the user a choice via the toast action API:
  // paste verbatim, or run an AI outline pass. Returns true so
  // CanvasNote suppresses the native paste; we drop the result
  // ourselves once the user picks.
  const handleLongTextPaste = React.useCallback((text: string): boolean => {
    const api = canvasRef.current?.getExcalidrawApi();
    if (!api) return false;
    const insertVerbatim = () => {
      const a = canvasRef.current?.getExcalidrawApi();
      if (a) appendTextToScene(a, text, { focus: true });
    };
    const outlineNow = async () => {
      const a = canvasRef.current?.getExcalidrawApi();
      if (!a) return;
      const placeholderId = appendTextToScene(a, 'Outlining your paste…', {
        focus: true,
      });
      const toastId = toast.loading('Outlining with AI…');
      try {
        const outline = await outlinePastedText(text);
        if (placeholderId) {
          const elements = a.getSceneElements();
          const next = elements.map((el) =>
            el.id === placeholderId ? { ...el, isDeleted: true, updated: Date.now() } : el,
          );
          a.updateScene({ elements: next });
        }
        appendTextToScene(a, outline || text, { focus: true });
        toast.success('Outline added.', { id: toastId });
      } catch (err) {
        if (placeholderId) {
          const elements = a.getSceneElements();
          const next = elements.map((el) =>
            el.id === placeholderId ? { ...el, isDeleted: true, updated: Date.now() } : el,
          );
          a.updateScene({ elements: next });
        }
        toast.error((err as Error).message || 'Outline failed', { id: toastId });
      }
    };
    toast.message('Big paste detected.', {
      description: `${text.length.toLocaleString()} characters — outline with AI?`,
      duration: 8000,
      action: { label: 'Outline', onClick: () => void outlineNow() },
      cancel: { label: 'As-is', onClick: insertVerbatim },
    });
    return true;
  }, []);

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
    <div
      className="flex h-full flex-col"
      onContextMenu={(e) => {
        // Suppress the native browser menu anywhere in the note shell
        // unless an inner Radix ContextMenuTrigger has already handled it.
        // Radix preventDefaults during bubbling, so this only fires for
        // bare chrome (header buttons, panels, surface backdrop, etc.).
        if (!e.defaultPrevented) e.preventDefault();
      }}
    >
      <FocusMode />
      <header
        className="bg-background/70 flex shrink-0 items-center gap-2 border-b px-4 py-2 backdrop-blur"
        data-focus-hide
      >
        <ConnectionPill status={status} synced={synced} />

        <div className="bg-border mx-2 h-5 w-px" />

        <SurfaceSwitcher value={surface} onChange={setSurface} />

        <NoteStatsChip plaintext={note.plaintext} />

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={togglePin}
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
          <VoiceModeButton canvasRef={canvasRef} />
          <HoldToRecord canvasRef={canvasRef} />
          <ApplyTemplateButton noteId={note.id} onInsert={insertContent} />
          <NoteAiMenu noteId={note.id} onInsert={insertContent} canvasRef={canvasRef} />
          <Button
            size="icon-sm"
            variant={commentsOpen ? 'default' : 'ghost'}
            onClick={() => {
              setCommentsOpen((v) => !v);
              if (!commentsOpen) setChatOpen(false);
            }}
            aria-label="Toggle comments"
            title={commentsOpen ? 'Close comments' : 'Open comments'}
          >
            <MessageCircle />
          </Button>
          <Button
            size="icon-sm"
            variant={chatOpen ? 'default' : 'ghost'}
            onClick={() => {
              setChatOpen((v) => !v);
              if (!chatOpen) setCommentsOpen(false);
            }}
            aria-label="Toggle chat"
            title={chatOpen ? 'Close chat' : 'Chat with this note'}
          >
            <MessageSquare />
          </Button>
          <Button
            size="icon-sm"
            variant={meetingOpen ? 'default' : 'ghost'}
            onClick={() => {
              setMeetingOpen((v) => !v);
              if (!meetingOpen) {
                setChatOpen(false);
                setCommentsOpen(false);
              }
            }}
            aria-label="Toggle meeting mode"
            title={meetingOpen ? 'Close meeting' : 'Meeting mode'}
          >
            <Mic />
          </Button>
          <VersionHistory noteId={note.id} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  if (!doc) return;
                  if (
                    !confirm(
                      'Convert TipTap text blocks on this note to Excalidraw text? This is a one-way migration. Rich formatting (headings, lists, math, mermaid, callouts) will become plain text.',
                    )
                  )
                    return;
                  try {
                    const result = migrateBlocksToExcalidraw(doc);
                    if (result.count === 0) {
                      toast.success('No text blocks to migrate.');
                      return;
                    }
                    toast.success(
                      `Migrated ${result.count} block${result.count === 1 ? '' : 's'} to Excalidraw.`,
                    );
                    if (Object.keys(result.blockToElement).length > 0) {
                      try {
                        const { updated } = await rewireCommentsAfterMigration({
                          noteId: note.id,
                          mapping: result.blockToElement,
                        });
                        if (updated > 0) {
                          toast.success(
                            `Re-anchored ${updated} comment${updated === 1 ? '' : 's'}.`,
                          );
                        }
                      } catch (err) {
                        toast.error(`Comment re-anchor failed: ${(err as Error).message}`);
                      }
                    }
                  } catch (err) {
                    toast.error(`Migration failed: ${(err as Error).message}`);
                  }
                }}
              >
                Convert text blocks to Excalidraw…
              </DropdownMenuItem>
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
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
                <NoteCoverBanner
                  noteId={note.id}
                  initialUrl={note.coverUrl ?? null}
                  initialPosition={note.coverPosition ?? 50}
                />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Untitled"
                  className="placeholder:text-muted-foreground w-full bg-transparent font-serif text-3xl font-semibold tracking-tight outline-none"
                />
                <div className="mt-2 flex items-center gap-3">
                  <TagChips noteId={note.id} />
                  <NoteStats doc={doc} />
                  <WordCountChip canvasRef={canvasRef} />
                  <SmartLinkChip plaintext={note.plaintext} />
                  <NoteColorPicker noteId={note.id} currentColor={note.color} />
                  <ReadingMode canvasRef={canvasRef} noteTitle={title} />
                  <NoteLockOverlay noteId={note.id} />
                </div>
                <RolloverBanner noteId={note.id} noteTitle={title} canvasRef={canvasRef} />
                <RecurringRollBanner noteId={note.id} canvasRef={canvasRef} />
                <CanvasMigrationBanner noteId={note.id} doc={doc} />
                <NotePropertiesPanel noteId={note.id} />
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
                  // Remount once Hocuspocus reports the initial snapshot
                  // has been applied. Without this, a fast race between
                  // CanvasNote subscribing to the Y.Doc and the IDB /
                  // websocket payload landing left the canvas blank
                  // until the user switched notes or drew something.
                  key={synced ? `${note.id}:ready` : `${note.id}:pending`}
                  ref={canvasRef}
                  doc={doc}
                  provider={provider}
                  user={{ name: user.name, color: colorFor(user.id) }}
                  searchBacklinks={searchBacklinkCandidates}
                  createBacklink={createNoteFromBacklink}
                  aiContext={{ run: runSlashAi, noteId: note.id }}
                  onCommentBlock={onCommentBlock}
                  viewportKey={`notai:viewport:${note.id}`}
                  minimap={surface.minimap}
                  onMinimapCornerChange={(corner) =>
                    setSurface({ ...surface, minimap: { ...surface.minimap, corner } })
                  }
                  onUrlPaste={handleUrlPaste}
                  onLongTextPaste={handleLongTextPaste}
                />
                <FocusModeOverlay
                  getApi={() => (canvasRef.current?.getExcalidrawApi() as never) ?? null}
                />
                <BulletReorder
                  getApi={() => (canvasRef.current?.getExcalidrawApi() as never) ?? null}
                />
                <NoteSearch canvasRef={canvasRef} />
                <CanvasQuickMath canvasRef={canvasRef} />
                <CanvasSnippets canvasRef={canvasRef} />
                <StickyFromSelection canvasRef={canvasRef} />
              </div>
              <BacklinksPanel noteId={note.id} />
              <NoteLinkPreviews plaintext={note.plaintext} />
              <NoteMiniGraph noteId={note.id} />
              <RelatedNotesRail noteId={note.id} />
            </>
          )}
        </div>
        <NoteChatPanel noteId={note.id} open={chatOpen} onOpenChange={setChatOpen} />
        <NoteCommentsPanel
          noteId={note.id}
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
          pendingAnchor={pendingCommentAnchor}
          onPendingAnchorClear={() => setPendingCommentAnchor(null)}
        />
        <MeetingModePanel
          noteId={note.id}
          open={meetingOpen}
          onOpenChange={setMeetingOpen}
          onInsertMarkdown={(md) => {
            insertContent(`\n\n${md}\n\n`);
          }}
        />
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
