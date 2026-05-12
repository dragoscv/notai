'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Image as ImageIcon, Trash2, Move, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { setNoteCover, setNoteCoverPosition, removeNoteCover } from '@/server/actions/notes';
import { startAssetUpload, finishAssetUpload } from '@/server/actions/assets';

interface Props {
  noteId: string;
  initialUrl: string | null;
  initialPosition: number;
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

/**
 * Notion/Craft-style cover banner. Sits above the title. When no cover
 * is set, renders a subtle "Add cover" affordance. Once set, hovering
 * shows reposition/remove controls; reposition mode lets the user drag
 * vertically to choose the focal point (`object-position-y` 0..100).
 */
export function NoteCoverBanner({ noteId, initialUrl, initialPosition }: Props) {
  const t = useTranslations('editor.cover');
  const [url, setUrl] = React.useState(initialUrl);
  const [position, setPosition] = React.useState(initialPosition);
  const [repositioning, setRepositioning] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const bannerRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ startY: number; startPos: number } | null>(null);

  const onPick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { uploadUrl, key, publicUrl } = await startAssetUpload({
        noteId,
        filename: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await finishAssetUpload({
        noteId,
        key,
        mime: file.type,
        sizeBytes: file.size,
        url: publicUrl,
      });
      await setNoteCover({ noteId, url: publicUrl });
      setUrl(publicUrl);
      setPosition(50);
      toast.success(t('toast.added'));
    } catch (err) {
      toast.error((err as Error).message || t('toast.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async () => {
    try {
      await removeNoteCover(noteId);
      setUrl(null);
      setPosition(50);
      setRepositioning(false);
    } catch (err) {
      toast.error((err as Error).message || t('toast.removeFailed'));
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!repositioning) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startPos: position };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const banner = bannerRef.current;
    if (!drag || !banner) return;
    const h = banner.getBoundingClientRect().height || 1;
    const dy = e.clientY - drag.startY;
    const next = Math.max(0, Math.min(100, drag.startPos - (dy / h) * 100));
    setPosition(next);
  };
  const onPointerUp = async () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      await setNoteCoverPosition({ noteId, position });
    } catch {
      /* best-effort save */
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        onChange={onFile}
        className="hidden"
        aria-hidden
      />

      {url ? (
        <div
          ref={bannerRef}
          className="group relative -mx-8 mb-4 h-44 select-none overflow-hidden md:h-56"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ cursor: repositioning ? 'ns-resize' : 'default' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="size-full object-cover"
            style={{ objectPosition: `50% ${position}%` }}
            draggable={false}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-[var(--background)]" />

          <div className="pointer-events-auto absolute right-3 top-3 flex gap-1.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
            {repositioning ? (
              <>
                <button
                  type="button"
                  onClick={() => setRepositioning(false)}
                  className="bg-background/90 text-foreground hover:bg-background inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur"
                  aria-label={t('doneAria')}
                >
                  <Check className="size-3" /> {t('done')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onPick}
                  disabled={uploading}
                  className="bg-background/90 text-foreground hover:bg-background inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur disabled:opacity-60"
                >
                  <ImageIcon className="size-3" /> {t('change')}
                </button>
                <button
                  type="button"
                  onClick={() => setRepositioning(true)}
                  className="bg-background/90 text-foreground hover:bg-background inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur"
                >
                  <Move className="size-3" /> {t('reposition')}
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="bg-background/90 text-destructive hover:bg-background inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur"
                >
                  <Trash2 className="size-3" /> {t('remove')}
                </button>
              </>
            )}
          </div>

          {repositioning && (
            <div className="bg-background/90 text-muted-foreground pointer-events-none absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-medium shadow-sm backdrop-blur">
              {t('dragHint', { percent: Math.round(position) })}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/40 -ml-1 mb-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition disabled:opacity-60"
        >
          {uploading ? (
            <>
              <X className="size-3 animate-pulse" /> {t('uploading')}
            </>
          ) : (
            <>
              <ImageIcon className="size-3.5" /> {t('addCover')}
            </>
          )}
        </button>
      )}
    </div>
  );
}
