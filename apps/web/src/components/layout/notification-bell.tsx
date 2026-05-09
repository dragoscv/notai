'use client';
import * as React from 'react';
import Link from 'next/link';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@notai/ui/components/popover';
import { cn } from '@notai/lib/utils';
import {
  listNotifications,
  unreadCount,
  markAllRead,
  markRead,
  type NotificationRow,
} from '@/server/actions/notifications';

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const refreshCount = React.useCallback(async () => {
    try {
      setUnread(await unreadCount());
    } catch {
      /* network errors are non-fatal in the UI */
    }
  }, []);

  React.useEffect(() => {
    void refreshCount();
    const t = setInterval(refreshCount, 60_000);
    return () => clearInterval(t);
  }, [refreshCount]);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    listNotifications({ limit: 20 })
      .then((rows) => setItems(rows))
      .finally(() => setLoading(false));
  }, [open]);

  const onClickItem = async (n: NotificationRow) => {
    if (!n.readAt) {
      try {
        await markRead({ ids: [n.id] });
      } catch {
        /* ignore */
      }
      setItems((prev) =>
        prev.map((it) => (it.id === n.id ? { ...it, readAt: new Date().toISOString() } : it)),
      );
      setUnread((c) => Math.max(0, c - 1));
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
          className="relative"
        >
          {unread > 0 ? <BellRing className="size-4" /> : <Bell className="size-4" />}
          {unread > 0 && (
            <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 grid min-w-[14px] place-items-center rounded-full px-1 text-[9px] font-semibold leading-[14px] shadow">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={6} className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-[11px]"
            onClick={async () => {
              try {
                await markAllRead();
                setItems((prev) =>
                  prev.map((it) => (it.readAt ? it : { ...it, readAt: new Date().toISOString() })),
                );
                setUnread(0);
              } catch {
                /* ignore */
              }
            }}
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {loading ? (
            <div className="text-muted-foreground inline-flex items-center gap-2 px-3 py-3 text-xs">
              <Loader2 className="size-3.5 animate-spin" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-xs">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationItem n={n} onClick={() => onClickItem(n)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({ n, onClick }: { n: NotificationRow; onClick: () => void }) {
  const noteId = n.payload.noteId;
  const href = noteId
    ? `/app/n/${noteId}${n.payload.commentId ? `?comment=${n.payload.commentId}` : ''}`
    : '#';
  const verb =
    n.kind === 'comment_mention'
      ? 'mentioned you'
      : n.kind === 'comment_reply'
        ? 'replied to your comment'
        : 'invited you';
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'hover:bg-accent/60 block px-3 py-2 transition-colors',
        !n.readAt && 'bg-primary/5',
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium">{n.payload.fromUserName ?? 'Someone'}</span>
        <span className="text-muted-foreground text-[11px]">{verb}</span>
        <time
          className="text-muted-foreground ml-auto text-[10px]"
          dateTime={n.createdAt}
          title={new Date(n.createdAt).toLocaleString()}
        >
          {timeAgo(n.createdAt)}
        </time>
      </div>
      {n.payload.noteTitle && (
        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
          in <span className="text-foreground/80">{n.payload.noteTitle}</span>
        </p>
      )}
      {n.payload.snippet && <p className="mt-0.5 line-clamp-2 text-xs">{n.payload.snippet}</p>}
    </Link>
  );
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'now';
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  if (ms < 7 * 86_400_000) return `${Math.round(ms / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}
