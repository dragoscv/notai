'use client';
import * as React from 'react';
import {
  Loader2,
  MessageCircle,
  Send,
  Trash2,
  X,
  Check,
  RotateCcw,
  CornerDownRight,
  AtSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { Avatar, AvatarFallback, AvatarImage } from '@notai/ui/components/avatar';
import { Textarea } from '@notai/ui/components/textarea';
import { cn, getInitials } from '@notai/lib/utils';
import {
  listComments,
  addComment,
  deleteComment,
  resolveComment,
  unresolveComment,
  searchMentionableUsers,
  type CommentRow,
  type MentionUser,
} from '@/server/actions/comments';

export interface NoteCommentsPanelProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * When set, the next "Send" submits the comment with this anchor.
   * Cleared after submit.
   */
  pendingAnchor?: CommentRow['anchor'] | null;
  onPendingAnchorClear?: () => void;
}

interface DraftMention {
  user: MentionUser;
  /** Display token in the body, e.g. `@Alice`. We re-resolve at send time. */
  display: string;
}

export function NoteCommentsPanel({
  noteId,
  open,
  onOpenChange,
  pendingAnchor,
  onPendingAnchorClear,
}: NoteCommentsPanelProps) {
  const t = useTranslations('noteWorkspace.comments');
  const [items, setItems] = React.useState<CommentRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [picker, setPicker] = React.useState<{
    open: boolean;
    query: string;
    users: MentionUser[];
    activeIdx: number;
  }>({
    open: false,
    query: '',
    users: [],
    activeIdx: 0,
  });
  const [mentions, setMentions] = React.useState<DraftMention[]>([]);
  const [replyTo, setReplyTo] = React.useState<CommentRow | null>(null);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listComments(noteId);
      setItems(rows);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  React.useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items]);

  React.useEffect(() => {
    if (pendingAnchor && open) {
      // Focus the composer when a block-anchored comment is requested.
      setTimeout(() => taRef.current?.focus(), 50);
    }
  }, [pendingAnchor, open]);

  // Mention picker: triggered when the textarea contains an `@` followed
  // by an unfinished word at the caret. Cheap & good enough — power users
  // can land on a full TipTap mention later.
  const onBodyChange = (next: string) => {
    setBody(next);
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? next.length;
    const upToCaret = next.slice(0, caret);
    const m = /(^|\s)@([\w.-]{0,40})$/.exec(upToCaret);
    if (m) {
      const q = m[2] ?? '';
      void searchMentionableUsers(noteId, q)
        .then((users) => setPicker({ open: true, query: q, users, activeIdx: 0 }))
        .catch(() => setPicker((p) => ({ ...p, open: false })));
    } else {
      setPicker((p) => (p.open ? { ...p, open: false } : p));
    }
  };

  const insertMention = (user: MentionUser) => {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? body.length;
    const upToCaret = body.slice(0, caret);
    const m = /(^|\s)@([\w.-]{0,40})$/.exec(upToCaret);
    if (!m) return;
    const start = m.index + (m[1] ? m[1].length : 0);
    const display = `@${(user.name ?? user.email ?? 'user').replace(/\s+/g, '')}`;
    const after = body.slice(caret);
    const next = `${body.slice(0, start)}${display} ${after}`;
    setBody(next);
    setMentions((prev) =>
      prev.some((p) => p.user.id === user.id) ? prev : [...prev, { user, display }],
    );
    setPicker((p) => ({ ...p, open: false }));
    setTimeout(() => {
      const newCaret = start + display.length + 1;
      ta?.setSelectionRange(newCaret, newCaret);
      ta?.focus();
    }, 0);
  };

  const send = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      // Keep only mentions whose display still appears in the final body.
      const liveMentions = mentions.filter((m) => text.includes(m.display));
      const anchor: CommentRow['anchor'] = replyTo?.anchor ?? pendingAnchor ?? { kind: 'note' };
      const row = await addComment({
        noteId,
        body: text,
        anchor,
        parentId: replyTo?.id ?? null,
        mentionUserIds: liveMentions.map((m) => m.user.id),
      });
      setItems((prev) => [...prev, row]);
      setBody('');
      setMentions([]);
      setReplyTo(null);
      onPendingAnchorClear?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onResolve = async (c: CommentRow) => {
    try {
      if (c.resolvedAt) {
        await unresolveComment({ id: c.id });
      } else {
        await resolveComment({ id: c.id });
      }
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (c: CommentRow) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await deleteComment({ id: c.id });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!open) return null;

  // Group: top-level by anchor; replies under their parent.
  const topLevel = items.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, CommentRow[]>();
  for (const c of items) {
    if (!c.parentId) continue;
    const arr = repliesByParent.get(c.parentId) ?? [];
    arr.push(c);
    repliesByParent.set(c.parentId, arr);
  }

  return (
    <aside
      className="bg-card flex h-full w-[380px] shrink-0 flex-col border-l"
      data-focus-hide
      aria-label={t('panelAria')}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <MessageCircle className="size-4 text-amber-500" />
        <span className="text-sm font-semibold">{t('heading')}</span>
        <span className="text-muted-foreground ml-1 text-xs">
          {items.length === 0 ? '' : `(${items.length})`}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => onOpenChange(false)}
          aria-label={t('close')}
          title={t('close')}
        >
          <X className="size-3.5" />
        </Button>
      </header>

      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin" />
            {t('loading')}
          </div>
        ) : topLevel.length === 0 && !pendingAnchor ? (
          <div className="text-muted-foreground space-y-2 py-6 text-center text-xs">
            <MessageCircle className="text-primary mx-auto size-5" />
            <p>{t('emptyHeading')}</p>
            <p>
              {t('emptyHint1')}
              <br />
              {t('emptyHint2')}
            </p>
          </div>
        ) : (
          topLevel.map((c) => (
            <CommentBlock
              key={c.id}
              comment={c}
              replies={repliesByParent.get(c.id) ?? []}
              onReply={(target) => {
                setReplyTo(target);
                setTimeout(() => taRef.current?.focus(), 30);
              }}
              onResolve={onResolve}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t p-2"
      >
        {(replyTo || pendingAnchor) && (
          <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[11px]">
            <CornerDownRight className="size-3" />
            {replyTo ? (
              <>
                {t('replyingTo', {
                  who: replyTo.author.name || replyTo.author.email || t('comment'),
                })}
              </>
            ) : pendingAnchor?.kind === 'block' ? (
              <>{t('anchoredBlock')}</>
            ) : pendingAnchor?.kind === 'canvas' ? (
              <>{t('anchoredCanvas')}</>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                onPendingAnchorClear?.();
              }}
              className="hover:bg-accent ml-auto rounded"
              aria-label={t('clearContext')}
            >
              <X className="size-3" />
            </button>
          </div>
        )}
        <div className="bg-background focus-within:border-primary/50 relative flex items-end gap-1 rounded-xl border p-1.5">
          <Textarea
            ref={taRef}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !picker.open) {
                e.preventDefault();
                void send();
              } else if (picker.open) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setPicker((p) => ({
                    ...p,
                    activeIdx: (p.activeIdx + 1) % Math.max(p.users.length, 1),
                  }));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setPicker((p) => ({
                    ...p,
                    activeIdx:
                      (p.activeIdx - 1 + Math.max(p.users.length, 1)) % Math.max(p.users.length, 1),
                  }));
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                  const u = picker.users[picker.activeIdx];
                  if (u) {
                    e.preventDefault();
                    insertMention(u);
                  }
                } else if (e.key === 'Escape') {
                  setPicker((p) => ({ ...p, open: false }));
                }
              }
            }}
            placeholder={t('placeholder')}
            rows={2}
            className="min-h-[2.25rem] resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={body.trim().length < 1 || busy}
            aria-label={t('send')}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </Button>
          {picker.open && picker.users.length > 0 && (
            <div className="bg-popover absolute bottom-full left-0 z-20 mb-1 w-full max-w-[320px] overflow-hidden rounded-md border shadow-lg">
              {picker.users.map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => insertMention(u)}
                  onMouseEnter={() => setPicker((p) => ({ ...p, activeIdx: i }))}
                  className={cn(
                    'flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs',
                    i === picker.activeIdx ? 'bg-primary/10' : '',
                  )}
                >
                  <Avatar className="size-5">
                    {u.image && <AvatarImage src={u.image} alt="" />}
                    <AvatarFallback className="text-[9px]">
                      {getInitials(u.name ?? '', u.email ?? '')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate">{u.name || u.email || t('user')}</span>
                  {u.email && u.name && (
                    <span className="text-muted-foreground max-w-[120px] truncate text-[10px]">
                      {u.email}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-muted-foreground mt-1 px-1 text-[10px]">
          <AtSign className="mr-0.5 inline size-2.5" />
          {t('mentionHint')}
        </p>
      </form>
    </aside>
  );
}

function CommentBlock({
  comment,
  replies,
  onReply,
  onResolve,
  onDelete,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  onReply: (c: CommentRow) => void;
  onResolve: (c: CommentRow) => void;
  onDelete: (c: CommentRow) => void;
}) {
  const isResolved = !!comment.resolvedAt;
  return (
    <div className={cn('rounded-lg border px-2.5 py-2', isResolved && 'bg-muted/30 opacity-70')}>
      <CommentRowView
        comment={comment}
        onReply={() => onReply(comment)}
        onResolve={() => onResolve(comment)}
        onDelete={() => onDelete(comment)}
      />
      {replies.length > 0 && (
        <div className="mt-2 space-y-2 border-l pl-3">
          {replies.map((r) => (
            <CommentRowView
              key={r.id}
              comment={r}
              onReply={() => onReply(comment)}
              onDelete={() => onDelete(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentRowView({
  comment,
  onReply,
  onResolve,
  onDelete,
}: {
  comment: CommentRow;
  onReply?: () => void;
  onResolve?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations('noteWorkspace.comments');
  const isResolved = !!comment.resolvedAt;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Avatar className="size-6">
          {comment.author.image && <AvatarImage src={comment.author.image} alt="" />}
          <AvatarFallback className="text-[10px]">
            {getInitials(comment.author.name ?? '', comment.author.email ?? '')}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-medium">
          {comment.author.name || comment.author.email || t('user')}
        </span>
        <time
          dateTime={comment.createdAt}
          className="text-muted-foreground text-[10px]"
          title={new Date(comment.createdAt).toLocaleString()}
        >
          {timeAgo(comment.createdAt, t('now'))}
        </time>
        {comment.anchor.kind === 'block' && (
          <span className="text-muted-foreground rounded-full border px-1.5 py-0 text-[9px] uppercase">
            {t('block')}
          </span>
        )}
        {comment.anchor.kind === 'canvas' && (
          <span className="text-muted-foreground rounded-full border px-1.5 py-0 text-[9px] uppercase">
            {t('pin')}
          </span>
        )}
        {isResolved && (
          <span className="text-muted-foreground inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[9px] uppercase">
            <Check className="size-2.5" /> {t('resolved')}
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap pl-8 text-xs leading-relaxed">{comment.body}</p>
      <div className="text-muted-foreground flex gap-2 pl-8 text-[10px]">
        {onReply && (
          <button type="button" className="hover:text-foreground" onClick={onReply}>
            {t('reply')}
          </button>
        )}
        {onResolve && (
          <button
            type="button"
            className="hover:text-foreground inline-flex items-center gap-0.5"
            onClick={onResolve}
          >
            {isResolved ? (
              <>
                <RotateCcw className="size-2.5" /> {t('reopen')}
              </>
            ) : (
              <>
                <Check className="size-2.5" /> {t('resolve')}
              </>
            )}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="hover:text-destructive ml-auto inline-flex items-center gap-0.5"
            onClick={onDelete}
            aria-label={t('deleteAria')}
          >
            <Trash2 className="size-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string, nowLabel = 'now') {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return nowLabel;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  if (ms < 7 * 86_400_000) return `${Math.round(ms / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}
