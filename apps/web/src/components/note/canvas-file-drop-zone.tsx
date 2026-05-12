'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { appendTextToScene, type CanvasNoteHandle } from '@notai/editor';
import { finishAssetUpload, startAssetUpload } from '@/server/actions/assets';

/**
 * Catches files dragged from the OS onto the note's canvas region,
 * uploads each one to bucket storage, then drops a markdown-style link
 * (or image) into the Excalidraw scene as a text element. Image
 * drops produced by Excalidraw itself (which natively pastes/handles
 * images) are NOT intercepted — we only fire when a real file leaves
 * the OS.
 */
export function CanvasFileDropZone({
  noteId,
  canvasRef,
  children,
}: {
  noteId: string;
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
  children: React.ReactNode;
}) {
  const t = useTranslations('editor.assets.drop');
  const tAssets = useTranslations('editor.assets');
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const dragCounter = React.useRef(0);

  const hasFiles = (e: React.DragEvent) => {
    const t = e.dataTransfer?.types;
    if (!t) return false;
    return Array.from(t).includes('Files');
  };

  const uploadOne = React.useCallback(
    async (file: File) => {
      const api = canvasRef.current?.getExcalidrawApi();
      const { uploadUrl, key, publicUrl } = await startAssetUpload({
        noteId,
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await finishAssetUpload({
        noteId,
        key,
        mime: file.type,
        sizeBytes: file.size,
        url: publicUrl,
      });
      if (api) {
        const isImage = (file.type || '').startsWith('image/');
        const md = isImage ? `![${file.name}](${publicUrl})` : `📎 ${file.name}\n${publicUrl}`;
        appendTextToScene(api, md, { focus: false });
      }
    },
    [canvasRef, noteId],
  );

  const onDrop = async (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    const tId = toast.loading(
      files.length === 1 ? t('uploadingOne') : t('uploadingMany', { count: files.length }),
    );
    let ok = 0;
    let fail = 0;
    for (const f of files) {
      try {
        await uploadOne(f);
        ok += 1;
      } catch (err) {
        fail += 1;
        // Surface the first error so the user sees what went wrong.
        if (fail === 1) toast.error((err as Error).message || tAssets('uploadFailed'), { id: tId });
      }
    }
    setBusy(false);
    if (fail === 0) {
      toast.success(ok === 1 ? t('successOne') : t('successOther', { count: ok }), { id: tId });
    } else if (ok > 0) {
      toast.message(t('partial', { ok, fail }), { id: tId });
    }
  };

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        dragCounter.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
      }}
      onDragLeave={() => {
        dragCounter.current = Math.max(0, dragCounter.current - 1);
        if (dragCounter.current === 0) setDragging(false);
      }}
      onDrop={(e) => void onDrop(e)}
    >
      {children}
      {(dragging || busy) && (
        <div
          aria-hidden
          className="border-primary/60 bg-primary/5 pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-xl border-2 border-dashed backdrop-blur-[1px]"
        >
          <div className="bg-popover text-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm shadow">
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> {t('uploading')}
              </>
            ) : (
              <>
                <Upload className="size-4" /> {t('dropToAttach')}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
