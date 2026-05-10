'use client';

import * as React from 'react';
import { Globe, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { Switch } from '@notai/ui/components/switch';
import {
  enablePublicShare,
  disablePublicShare,
  getPublicShareStatus,
} from '@/server/actions/public-share';

/**
 * Toggle for the public read-only share link. Lives inside the
 * existing ShareDialog. Owner-only.
 */
export function PublicShareSection({ noteId }: { noteId: string }) {
  const [enabled, setEnabled] = React.useState(false);
  const [token, setToken] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<Date | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    void getPublicShareStatus(noteId).then((r) => {
      if (!r) return;
      setEnabled(Boolean(r.token));
      setToken(r.token);
      setExpiresAt(r.expiresAt);
    });
  }, [noteId]);

  const url = React.useMemo(() => {
    if (!token || typeof window === 'undefined') return '';
    return `${window.location.origin}/p/${token}`;
  }, [token]);

  const onToggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        const res = await enablePublicShare({ noteId });
        setEnabled(true);
        setToken(res.token);
        setExpiresAt(res.expiresAt);
        toast.success('Public link created.');
      } else {
        await disablePublicShare(noteId);
        setEnabled(false);
        setToken(null);
        setExpiresAt(null);
        toast.message('Public link disabled.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update share state');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Globe className="text-muted-foreground size-4" />
        <div className="flex-1">
          <div className="text-sm font-medium">Public read-only link</div>
          <div className="text-muted-foreground text-xs">
            Anyone with the link can read the latest version of this note.
          </div>
        </div>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Switch checked={enabled} onCheckedChange={onToggle} aria-label="Public read-only link" />
        )}
      </div>
      {enabled && url && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="bg-background flex-1 truncate rounded-md border px-2 py-1 text-xs"
          />
          <Button type="button" size="sm" variant="ghost" onClick={copy}>
            <Copy className="size-3.5" />
          </Button>
        </div>
      )}
      {enabled && expiresAt && (
        <p className="text-muted-foreground text-[11px]">
          Expires {expiresAt.toLocaleDateString()}.
        </p>
      )}
    </div>
  );
}
