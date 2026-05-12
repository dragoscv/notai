'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Mic, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { appendTextToScene, type CanvasNoteHandle } from '@notai/editor';
import { transcribeAudio } from '@/server/actions/transcribe';
import { cn } from '@notai/lib/utils';

interface HoldToRecordProps {
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
}

const HOLD_TRIGGER_MS = 300;

/**
 * Press-and-hold microphone FAB. Press → wait 300ms (so a misclick is a
 * no-op) → start MediaRecorder; release → stop, transcribe, drop the
 * transcript at the current viewport center of the Excalidraw scene.
 *
 * Uses the simpler `transcribeAudio` server action (single text blob,
 * no segment splitting) — for long-form thoughts use the existing
 * Voice Mode button instead.
 */
export function HoldToRecord({ canvasRef }: HoldToRecordProps) {
  const t = useTranslations('editor.voice');
  const [state, setState] = React.useState<'idle' | 'arming' | 'recording' | 'transcribing'>(
    'idle',
  );
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const armTimerRef = React.useRef<number | null>(null);
  const cancelledRef = React.useRef(false);

  const finish = React.useCallback(async () => {
    setState('transcribing');
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size < 800) {
        toast.info(t('holdTooShort'));
        return;
      }
      const fd = new FormData();
      fd.append('audio', blob, 'hold-to-record.webm');
      const { text } = await transcribeAudio(fd);
      const trimmed = text.trim();
      if (!trimmed) {
        toast.info(t('nothingAudible'));
        return;
      }
      const api = canvasRef.current?.getExcalidrawApi();
      if (!api) {
        try {
          await navigator.clipboard.writeText(trimmed);
          toast.message(t('canvasNotReadyClipboard'));
        } catch {
          toast.error(t('canvasNotReadyNoClipboard'));
        }
        return;
      }
      const center = viewportCenterWorld(api);
      // For long transcripts (1\u2009000+ chars), offer to convert into a
      // tight outline via the same backend the smart-paste outline uses.
      // We don't auto-outline so a user dictating prose isn't surprised
      // by it being broken into bullets.
      if (trimmed.length >= 1000) {
        appendTextToScene(api, trimmed, { focus: true, at: center });
        toast.message('Long transcript captured.', {
          description: `${trimmed.length.toLocaleString()} chars \u2014 outline with AI?`,
          duration: 8000,
          action: {
            label: 'Outline',
            onClick: () => {
              void (async () => {
                const a = canvasRef.current?.getExcalidrawApi();
                if (!a) return;
                const placeholderId = appendTextToScene(a, 'Outlining transcript\u2026', {
                  focus: true,
                });
                const tid = toast.loading('Outlining\u2026');
                try {
                  const { outlinePastedText } = await import('@/server/actions/smart-paste');
                  const outline = await outlinePastedText(trimmed);
                  if (placeholderId) {
                    const elements = a.getSceneElements();
                    const next = elements.map((el) =>
                      el.id === placeholderId
                        ? { ...el, isDeleted: true, updated: Date.now() }
                        : el,
                    );
                    a.updateScene({ elements: next });
                  }
                  if (outline) appendTextToScene(a, outline, { focus: true });
                  toast.success('Outline added.', { id: tid });
                } catch (err) {
                  toast.error((err as Error).message || 'Outline failed', { id: tid });
                }
              })();
            },
          },
        });
        return;
      }
      appendTextToScene(api, trimmed, { focus: true, at: center });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setState('idle');
    }
  }, [canvasRef]);

  const startRecording = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void finish();
      };
      rec.start();
      recRef.current = rec;
      setState('recording');
    } catch (err) {
      toast.error(t('micFailed'));
      console.error(err);
      setState('idle');
    }
  }, [finish]);

  const onPointerDown = React.useCallback(
    (ev: React.PointerEvent<HTMLButtonElement>) => {
      if (state !== 'idle') return;
      ev.currentTarget.setPointerCapture(ev.pointerId);
      cancelledRef.current = false;
      setState('arming');
      armTimerRef.current = window.setTimeout(() => {
        armTimerRef.current = null;
        void startRecording();
      }, HOLD_TRIGGER_MS);
    },
    [state, startRecording],
  );

  const onPointerUp = React.useCallback(() => {
    if (armTimerRef.current != null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
      cancelledRef.current = true;
      setState('idle');
      return;
    }
    if (recRef.current && state === 'recording') {
      recRef.current.stop();
    }
  }, [state]);

  React.useEffect(
    () => () => {
      if (armTimerRef.current != null) window.clearTimeout(armTimerRef.current);
      if (recRef.current && recRef.current.state !== 'inactive') {
        try {
          recRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      disabled={state === 'transcribing'}
      title={t('holdTitle')}
      className={cn(
        'inline-flex size-9 select-none items-center justify-center rounded-full border shadow-sm transition',
        state === 'recording' &&
          'bg-destructive text-destructive-foreground border-destructive animate-pulse',
        state === 'arming' && 'bg-muted',
        state === 'idle' && 'bg-background hover:bg-muted text-muted-foreground',
        state === 'transcribing' && 'bg-background text-muted-foreground',
      )}
    >
      {state === 'transcribing' ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}

function viewportCenterWorld(api: {
  getAppState: () => {
    scrollX: number;
    scrollY: number;
    width: number;
    height: number;
    zoom: { value: number };
  };
}): { x: number; y: number } {
  const s = api.getAppState();
  const cx = s.width / 2;
  const cy = s.height / 2;
  return {
    x: cx / s.zoom.value - s.scrollX,
    y: cy / s.zoom.value - s.scrollY,
  };
}
