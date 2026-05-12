'use client';

import * as React from 'react';
import { Globe, Copy, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { Switch } from '@notai/ui/components/switch';
import {
  enablePublicShare,
  disablePublicShare,
  getPublicShareStatus,
  setPublicShareSlug,
} from '@/server/actions/public-share';
import { setNotePassword, clearNotePassword } from '@/server/actions/note-password';
import { BlogControls } from './blog-controls';

/**
 * Toggle for the public read-only share link. Lives inside the
 * existing ShareDialog. Owner-only.
 */
export function PublicShareSection({ noteId }: { noteId: string }) {
  const t = useTranslations('noteWorkspace.publicShare');
  const [enabled, setEnabled] = React.useState(false);
  const [token, setToken] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<Date | null>(null);
  const [slug, setSlug] = React.useState<string>('');
  const [savingSlug, setSavingSlug] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    void getPublicShareStatus(noteId).then((r) => {
      if (!r) return;
      setEnabled(Boolean(r.token));
      setToken(r.token);
      setExpiresAt(r.expiresAt);
      setPreviewUrl(r.imageUrl);
      // status doesn't currently return slug; we leave field empty so
      // the user can type one. (Server is the source of truth on save.)
    });
  }, [noteId]);

  // Round-trip with note-workspace's capture bridge. Resolves the
  // pending refresh promise when a ready/error event lands for this note.
  const pendingRef = React.useRef<{
    resolve: (url: string) => void;
    reject: (err: Error) => void;
  } | null>(null);
  React.useEffect(() => {
    const onReady = (e: Event) => {
      const detail = (e as CustomEvent<{ noteId: string; url?: string; error?: string }>).detail;
      if (!detail || detail.noteId !== noteId) return;
      const handler = pendingRef.current;
      pendingRef.current = null;
      if (!handler) return;
      if (detail.error) handler.reject(new Error(detail.error));
      else if (detail.url) handler.resolve(detail.url);
    };
    window.addEventListener('notai:share-preview-ready', onReady as EventListener);
    return () => window.removeEventListener('notai:share-preview-ready', onReady as EventListener);
  }, [noteId]);

  const capturePreview = React.useCallback(async (): Promise<string> => {
    if (pendingRef.current) {
      throw new Error('Capture already in progress');
    }
    return new Promise<string>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      const timer = window.setTimeout(() => {
        if (pendingRef.current) {
          pendingRef.current = null;
          reject(new Error('timeout'));
        }
      }, 20000);
      const wrapResolve = resolve;
      pendingRef.current.resolve = (url: string) => {
        window.clearTimeout(timer);
        wrapResolve(url);
      };
      const wrapReject = reject;
      pendingRef.current.reject = (err: Error) => {
        window.clearTimeout(timer);
        wrapReject(err);
      };
      window.dispatchEvent(new CustomEvent('notai:capture-share-preview', { detail: { noteId } }));
    });
  }, [noteId]);

  const refreshPreview = async () => {
    setRefreshing(true);
    const tid = toast.loading(t('previewRefreshing'));
    try {
      const url = await capturePreview();
      setPreviewUrl(url);
      toast.success(t('previewUpdated'), { id: tid });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg === 'empty-scene') {
        toast.message(t('previewEmptyScene'), { id: tid });
      } else if (msg === 'canvas-not-ready') {
        toast.error(t('previewCanvasNotReady'), { id: tid });
      } else {
        toast.error(t('previewFailed', { error: msg }), { id: tid });
      }
    } finally {
      setRefreshing(false);
    }
  };

  const url = React.useMemo(() => {
    if (typeof window === 'undefined') return '';
    if (slug.trim()) return `${window.location.origin}/p/${slug.trim().toLowerCase()}`;
    if (!token) return '';
    return `${window.location.origin}/p/${token}`;
  }, [token, slug]);

  const onToggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        const res = await enablePublicShare({ noteId });
        setEnabled(true);
        setToken(res.token);
        setExpiresAt(res.expiresAt);
        toast.success(t('linkCreated'));
        // Fire-and-forget initial preview capture so the OG card looks
        // right from the first share. Failures are non-fatal (the link
        // still works; the OG just falls back to the CSS card).
        void capturePreview()
          .then((capturedUrl) => setPreviewUrl(capturedUrl))
          .catch(() => {
            /* user can click Refresh later */
          });
      } else {
        await disablePublicShare(noteId);
        setEnabled(false);
        setToken(null);
        setExpiresAt(null);
        setPreviewUrl(null);
        toast.message(t('linkDisabled'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('updateFailed'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('couldntCopy'));
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Globe className="text-muted-foreground size-4" />
        <div className="flex-1">
          <div className="text-sm font-medium">{t('title')}</div>
          <div className="text-muted-foreground text-xs">{t('description')}</div>
        </div>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Switch checked={enabled} onCheckedChange={onToggle} aria-label={t('linkAria')} />
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
      {enabled && url && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]">
          <span>{t('shareLabel')}</span>
          <a
            className="hover:text-foreground underline"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(t('shareTwitterText'))}&url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </a>
          <a
            className="hover:text-foreground underline"
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
          <a
            className="hover:text-foreground underline"
            href={`mailto:?subject=${encodeURIComponent(t('shareEmailSubject'))}&body=${encodeURIComponent(url)}`}
          >
            Email
          </a>
        </div>
      )}
      {enabled && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">/p/</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={t('slugPlaceholder')}
            pattern="[a-zA-Z0-9-]*"
            maxLength={60}
            className="bg-background flex-1 rounded-md border px-2 py-1 text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={savingSlug}
            onClick={async () => {
              setSavingSlug(true);
              try {
                const res = await setPublicShareSlug({ noteId, slug });
                setSlug(res.slug ?? '');
                toast.success(res.slug ? t('slugSet', { slug: res.slug }) : t('slugCleared'));
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t('slugFailed'));
              } finally {
                setSavingSlug(false);
              }
            }}
          >
            {savingSlug ? <Loader2 className="size-3.5 animate-spin" /> : t('saveSlug')}
          </Button>
        </div>
      )}
      {enabled && expiresAt && (
        <p className="text-muted-foreground text-[11px]">
          {t('expires', { date: expiresAt.toLocaleDateString() })}
        </p>
      )}
      {enabled && (
        <div className="bg-muted/30 flex items-center gap-2 rounded-md border p-2">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="bg-background h-12 w-20 rounded border object-cover"
            />
          ) : (
            <div className="bg-background text-muted-foreground flex h-12 w-20 items-center justify-center rounded border text-[10px]">
              {t('previewNone')}
            </div>
          )}
          <div className="flex-1 text-[11px] leading-tight">
            <div className="font-medium">{t('previewTitle')}</div>
            <div className="text-muted-foreground">{t('previewHint')}</div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={refreshPreview}
          >
            {refreshing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            <span className="ml-1.5">{t('previewRefresh')}</span>
          </Button>
        </div>
      )}
      <div className="border-t pt-2">
        <details className="text-xs">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer select-none">
            {t('passwordSummary')}
          </summary>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="password"
              placeholder={t('passwordPlaceholder')}
              minLength={4}
              maxLength={200}
              className="bg-background flex-1 rounded-md border px-2 py-1 text-xs"
              id={`pw-${noteId}`}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                const el = document.getElementById(`pw-${noteId}`) as HTMLInputElement | null;
                const pw = el?.value ?? '';
                if (pw.length < 4) {
                  toast.error(t('tooShort'));
                  return;
                }
                try {
                  await setNotePassword({ noteId, password: pw });
                  if (el) el.value = '';
                  toast.success(t('passwordSet'));
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : t('passwordFailed'));
                }
              }}
            >
              {t('set')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  await clearNotePassword(noteId);
                  toast.message(t('passwordCleared'));
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : t('passwordFailed'));
                }
              }}
            >
              {t('clear')}
            </Button>
          </div>
        </details>
      </div>
      <BlogControls noteId={noteId} />
    </div>
  );
}
