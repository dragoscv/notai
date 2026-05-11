'use client';

import * as React from 'react';
import { CalendarClock, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@notai/ui/components/switch';
import {
  getNoteBlogStatus,
  setNoteBlogVisible,
  setNoteBlogPublishAt,
  type NoteBlogStatus,
} from '@/server/actions/blog';

/**
 * Tiny control inside the share dialog: lets the owner promote the note
 * to their public blog index (`/u/<handle>`), and optionally schedule
 * when it should appear. Until they own a `blogHandle` we just nudge
 * them to set one in settings.
 */
export function BlogControls({ noteId }: { noteId: string }) {
  const [status, setStatus] = React.useState<NoteBlogStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [now, setNow] = React.useState(0);

  React.useEffect(() => {
    void getNoteBlogStatus(noteId).then((s) => setStatus(s));
  }, [noteId]);
  React.useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  if (!status) {
    return (
      <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
        <Loader2 className="size-3 animate-spin" /> Loading blog status…
      </div>
    );
  }

  if (!status.ownerHandle) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs">
        <div className="mb-1 inline-flex items-center gap-2 font-medium">
          <Globe className="size-3.5" /> Blog
        </div>
        <p className="text-muted-foreground">
          Pick a handle in{' '}
          <a className="underline" href="/app/settings/blog">
            blog settings
          </a>{' '}
          to publish notes to <code>/u/&lt;handle&gt;</code>.
        </p>
      </div>
    );
  }

  // Datetime-local needs a timezone-naive value.
  const localValue = (() => {
    if (!status.publishAt) return '';
    const d = new Date(status.publishAt);
    const off = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  })();

  const toggleVisible = async (next: boolean) => {
    setBusy(true);
    try {
      await setNoteBlogVisible({ noteId, visible: next });
      setStatus((s) => (s ? { ...s, visible: next } : s));
      toast.success(next ? 'On your blog' : 'Hidden from blog');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updatePublishAt = async (raw: string) => {
    const date = raw ? new Date(raw) : null;
    setBusy(true);
    try {
      await setNoteBlogPublishAt({ noteId, publishAt: date });
      setStatus((s) => (s ? { ...s, publishAt: date?.toISOString() ?? null } : s));
      toast.success(date && date.getTime() > Date.now() ? 'Scheduled' : 'Publishes immediately');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const isFuture = status.publishAt ? new Date(status.publishAt).getTime() > now : false;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-sm font-medium">
            <Globe className="size-3.5" /> Show on /u/{status.ownerHandle}
          </div>
          <p className="text-muted-foreground text-xs">
            Lists this note on your public blog index and RSS feed.
          </p>
        </div>
        <Switch checked={status.visible} disabled={busy} onCheckedChange={toggleVisible} />
      </div>
      {status.visible && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CalendarClock className="size-3.5" />
            Publish at {isFuture && <em className="not-italic text-amber-500">scheduled</em>}
          </span>
          <input
            type="datetime-local"
            value={localValue}
            disabled={busy}
            onChange={(e) => void updatePublishAt(e.target.value)}
            className="bg-background w-full rounded-md border px-2 py-1 text-xs"
          />
          <span className="text-muted-foreground">
            Leave empty to publish immediately. Future dates hide the note from the index until
            then.
          </span>
        </label>
      )}
    </div>
  );
}
