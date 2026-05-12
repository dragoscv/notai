'use client';

import * as React from 'react';
import { Globe, Copy, Loader2 } from 'lucide-react';
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

  React.useEffect(() => {
    void getPublicShareStatus(noteId).then((r) => {
      if (!r) return;
      setEnabled(Boolean(r.token));
      setToken(r.token);
      setExpiresAt(r.expiresAt);
      // status doesn't currently return slug; we leave field empty so
      // the user can type one. (Server is the source of truth on save.)
    });
  }, [noteId]);

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
      } else {
        await disablePublicShare(noteId);
        setEnabled(false);
        setToken(null);
        setExpiresAt(null);
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
