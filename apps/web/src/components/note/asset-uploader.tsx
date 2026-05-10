'use client';
import * as React from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { toast } from 'sonner';
import { finishAssetUpload, startAssetUpload } from '@/server/actions/assets';
import { ocrImage } from '@/server/actions/ocr';

/**
 * Drag-and-drop / file-picker uploader. Calls the server to presign,
 * uploads directly to the bucket, then records the asset and lets the
 * caller embed the resulting URL (typically into the editor).
 */
export function AssetUploader({
  noteId,
  onUploaded,
  variant = 'button',
  className,
}: {
  noteId: string;
  onUploaded?: (a: { url: string; mime: string }) => void;
  variant?: 'button' | 'dropzone';
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  const [drag, setDrag] = React.useState(false);

  const upload = async (file: File) => {
    setPending(true);
    try {
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
      onUploaded?.({ url: publicUrl, mime: file.type });
      if (file.type.startsWith('image/')) {
        toast.success('Uploaded', {
          action: {
            label: 'Extract text',
            onClick: async () => {
              const t = toast.loading('Reading image…');
              try {
                const { text } = await ocrImage({ noteId, imageUrl: publicUrl });
                if (!text || text === '(no text detected)') {
                  toast.message('No readable text found.', { id: t });
                  return;
                }
                try {
                  const list = JSON.parse(
                    window.localStorage.getItem('notai:pending-appends') ?? '[]',
                  ) as Array<{ noteId: string; body: string; ts: number }>;
                  list.push({ noteId, body: text, ts: Date.now() });
                  window.localStorage.setItem('notai:pending-appends', JSON.stringify(list));
                } catch {
                  /* localStorage may be unavailable — fall back to copy-to-clipboard */
                  try {
                    await navigator.clipboard.writeText(text);
                    toast.success('Copied to clipboard.', { id: t });
                    return;
                  } catch {
                    /* ignore */
                  }
                }
                window.dispatchEvent(new CustomEvent('notai:pending-append-changed'));
                toast.success('Text added below the image.', { id: t });
              } catch (err) {
                toast.error((err as Error).message || 'OCR failed', { id: t });
              }
            },
          },
        });
      } else {
        toast.success('Uploaded');
      }
    } catch (err) {
      toast.error((err as Error).message ?? 'Upload failed');
    } finally {
      setPending(false);
    }
  };

  if (variant === 'dropzone') {
    return (
      <label
        className={`bg-card hover:bg-accent/50 group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-sm transition ${drag ? 'border-primary bg-primary/5' : ''} ${className ?? ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = '';
          }}
          disabled={pending}
        />
        {pending ? (
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        ) : (
          <ImagePlus className="text-muted-foreground size-5" />
        )}
        <p className="text-muted-foreground">
          {pending ? 'Uploading…' : 'Drop a file or click to upload'}
        </p>
      </label>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
        disabled={pending}
      />
      <Button
        size="sm"
        variant="ghost"
        className={`h-7 gap-1.5 px-2 text-xs ${className ?? ''}`}
        onClick={() => inputRef.current?.click()}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ImagePlus className="size-3.5" />
        )}
        {pending ? 'Uploading' : 'Attach'}
      </Button>
    </>
  );
}
