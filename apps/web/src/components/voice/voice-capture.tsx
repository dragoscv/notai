'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Square, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@notai/ui';
import { useHotkey } from '@notai/ui/hooks/use-hotkey';
import { createNoteFromVoice } from '@/server/actions/transcribe';
import { haptic } from '@/lib/haptics';

type State = 'idle' | 'recording' | 'transcribing';

/**
 * Global voice capture. ⌘⇧V opens the modal, starts recording immediately;
 * Stop / Esc / Enter ends recording and ships the audio to Whisper. The
 * transcript becomes a fresh note and the user is taken straight into it.
 */
export function VoiceCapture() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<State>('idle');
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const startedAtRef = React.useRef(0);
  const [elapsed, setElapsed] = React.useState(0);

  useHotkey('mod+shift+v', () => {
    setOpen(true);
  });

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    document.addEventListener('notai:voice-capture', onOpen);
    return () => document.removeEventListener('notai:voice-capture', onOpen);
  }, []);

  const cleanup = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    chunksRef.current = [];
  }, []);

  const finish = React.useCallback(async () => {
    setState('transcribing');
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      cleanup();
      if (blob.size < 800) {
        toast.info('Recording was too short.');
        setState('idle');
        setOpen(false);
        return;
      }
      const fd = new FormData();
      fd.append('audio', blob, 'voice.webm');
      const result = await createNoteFromVoice(fd);
      haptic('success');
      toast.success('Voice note saved');
      setOpen(false);
      setState('idle');
      router.push(`/app/n/${result.id}`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setState('idle');
      setOpen(false);
    }
  }, [cleanup, router]);

  const startRecording = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        void finish();
      };
      rec.start();
      recRef.current = rec;
      startedAtRef.current = performance.now();
      setElapsed(0);
      setState('recording');
    } catch (err) {
      toast.error("Couldn't access your microphone");
      console.error(err);
      setOpen(false);
    }
  }, [finish]);

  React.useEffect(() => {
    if (!open) return;
    if (state !== 'idle') return;
    void startRecording();
  }, [open, state, startRecording]);

  React.useEffect(() => {
    if (state !== 'recording') return;
    const start = startedAtRef.current;
    const t = setInterval(() => {
      setElapsed(Math.floor((performance.now() - start) / 1000));
    }, 250);
    return () => clearInterval(t);
  }, [state]);

  const stopRecording = () => {
    if (recRef.current && state === 'recording') {
      recRef.current.stop();
    }
  };

  const cancel = () => {
    if (recRef.current && state === 'recording') {
      try {
        recRef.current.onstop = null;
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
    cleanup();
    setState('idle');
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) cancel();
    else setOpen(true);
  };

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${ss.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" /> Voice capture
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          {state === 'recording' && (
            <>
              <button
                type="button"
                onClick={stopRecording}
                aria-label="Stop recording"
                className="bg-destructive text-destructive-foreground flex size-24 items-center justify-center rounded-full shadow-lg transition hover:scale-105"
              >
                <Square className="size-9" fill="currentColor" />
              </button>
              <div className="text-foreground font-mono text-lg tabular-nums">
                {formatTime(elapsed)}
              </div>
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="bg-destructive inline-block size-2 animate-pulse rounded-full" />
                Recording — click to stop
              </div>
            </>
          )}
          {state === 'transcribing' && (
            <>
              <div className="bg-muted text-muted-foreground flex size-24 items-center justify-center rounded-full">
                <Loader2 className="size-9 animate-spin" />
              </div>
              <div className="text-muted-foreground text-sm">Transcribing…</div>
            </>
          )}
          {state === 'idle' && (
            <>
              <div className="bg-muted text-muted-foreground flex size-24 items-center justify-center rounded-full">
                <Mic className="size-9" />
              </div>
              <div className="text-muted-foreground text-sm">Requesting microphone…</div>
            </>
          )}
        </div>
        <p className="text-muted-foreground text-center text-xs">
          Press <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> to
          cancel
        </p>
      </DialogContent>
    </Dialog>
  );
}
