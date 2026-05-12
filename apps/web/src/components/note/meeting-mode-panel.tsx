'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Mic,
  MicOff,
  Monitor,
  Square,
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ScreenShare,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@notai/ui/components/button';
import { Textarea } from '@notai/ui/components/textarea';
import { cn } from '@notai/lib/utils';
import { transcribeAudio } from '@/server/actions/transcribe';
import { enhanceMeetingNotes } from '@/server/actions/meeting';

/**
 * Meeting Mode — Granola-style ambient capture.
 *
 * The user hits "Start meeting", grants tab-audio + mic permission, and
 * keeps typing whatever they want into the raw-notes pane while the
 * conversation happens. Audio is captured locally in chunks. When they
 * hit "Stop", each chunk is transcribed (Whisper), the chunks are
 * concatenated, and "Enhance" merges raw notes + transcript into a
 * polished Markdown summary which gets handed back to the parent to
 * insert into the note.
 *
 * Privacy:
 *   - Audio never streams while idle.
 *   - The transcript stays in this component until the user explicitly
 *     hits "Enhance & insert".
 *   - No bot joins any call. The user shares their tab themselves.
 */
export function MeetingModePanel({
  noteId,
  open,
  onOpenChange,
  onInsertMarkdown,
}: {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user accepts the enhanced markdown. Parent decides where to put it. */
  onInsertMarkdown: (markdown: string) => void;
}) {
  const t = useTranslations('editor.meeting');
  const tActions = useTranslations('editor.meeting.actions');
  const tToast = useTranslations('editor.meeting.toast');
  type State = 'idle' | 'recording' | 'paused' | 'transcribing' | 'enhancing';
  const [state, setState] = React.useState<State>('idle');
  const [rawNotes, setRawNotes] = React.useState('');
  const [transcript, setTranscript] = React.useState('');
  const [includeMic, setIncludeMic] = React.useState(true);
  const [includeTab, setIncludeTab] = React.useState(true);
  const [elapsed, setElapsed] = React.useState(0); // seconds
  const [chunkProgress, setChunkProgress] = React.useState<{ done: number; total: number } | null>(
    null,
  );
  const [enhancement, setEnhancement] = React.useState<string | null>(null);

  const recRef = React.useRef<MediaRecorder | null>(null);
  const tabStreamRef = React.useRef<MediaStream | null>(null);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const mixedStreamRef = React.useRef<MediaStream | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startedAtRef = React.useRef<number>(0);
  const pausedAccumRef = React.useRef<number>(0);
  const tickRef = React.useRef<number | null>(null);
  // Forward ref so `start` can call `stop` (declared later) from the
  // tab-share-revoked event listener without creating a TDZ cycle.
  const stopRef = React.useRef<(() => Promise<void>) | null>(null);

  // Persist raw notes per-note so a tab close never loses them.
  const draftKey = `notai:meeting:draft:${noteId}`;
  React.useEffect(() => {
    if (!open) return;
    try {
      const v = window.localStorage.getItem(draftKey);
      if (v) setRawNotes(v);
    } catch {
      /* ignore */
    }
  }, [open, draftKey]);
  React.useEffect(() => {
    if (state === 'idle' && rawNotes.length === 0) return;
    try {
      window.localStorage.setItem(draftKey, rawNotes);
    } catch {
      /* ignore */
    }
  }, [rawNotes, draftKey, state]);

  /* ───────────────────────── timer ───────────────────────── */
  React.useEffect(() => {
    if (state !== 'recording') {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(() => {
      const live = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(Math.floor(pausedAccumRef.current + live));
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [state]);

  /* ───────────────────────── capture ───────────────────────── */
  const stopAllStreams = React.useCallback(() => {
    tabStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    mixedStreamRef.current?.getTracks().forEach((t) => t.stop());
    tabStreamRef.current = null;
    micStreamRef.current = null;
    mixedStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  const start = React.useCallback(async () => {
    if (state !== 'idle') return;
    if (!includeMic && !includeTab) {
      toast.error(tToast('pickSource'));
      return;
    }
    try {
      const sources: MediaStreamAudioSourceNode[] = [];
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();

      if (includeTab) {
        try {
          const tabStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true, // many browsers require requesting video to grant tab audio
          });
          // We don't actually want the video — stop the video tracks but keep audio.
          tabStream.getVideoTracks().forEach((t) => t.stop());
          if (tabStream.getAudioTracks().length === 0) {
            toast.error(tToast('noTabAudio'));
            tabStream.getTracks().forEach((t) => t.stop());
          } else {
            tabStreamRef.current = tabStream;
            sources.push(ctx.createMediaStreamSource(tabStream));
          }
        } catch (err) {
          if ((err as { name?: string }).name === 'NotAllowedError') {
            toast.error(tToast('tabCancelled'));
          } else {
            toast.error(tToast('tabFailed'));
          }
        }
      }

      if (includeMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = micStream;
          sources.push(ctx.createMediaStreamSource(micStream));
        } catch {
          toast.error(tToast('micFailed'));
        }
      }

      if (sources.length === 0) {
        stopAllStreams();
        return;
      }

      sources.forEach((s) => s.connect(dest));
      const mixed = dest.stream;
      mixedStreamRef.current = mixed;

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(mixed, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      // 60s chunks: keeps Whisper requests under the 25MB limit and lets
      // us show progress while the user waits.
      rec.start(60_000);
      recRef.current = rec;
      startedAtRef.current = Date.now();
      pausedAccumRef.current = 0;
      setElapsed(0);
      setTranscript('');
      setEnhancement(null);
      setState('recording');

      // Auto-stop if the user revokes tab share via the browser bar.
      tabStreamRef.current?.getAudioTracks().forEach((t) => {
        t.addEventListener('ended', () => {
          if (recRef.current) stopRef.current?.();
        });
      });
    } catch (err) {
      toast.error((err as Error).message);
      stopAllStreams();
    }
  }, [includeMic, includeTab, state, stopAllStreams]);

  const stop = React.useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    if (rec.state === 'recording' || rec.state === 'paused') {
      rec.stop();
    }
    recRef.current = null;
    stopAllStreams();
    setState('transcribing');

    // Wait one tick so the final ondataavailable fires.
    await new Promise<void>((r) => setTimeout(r, 50));

    const chunks = chunksRef.current.slice();
    chunksRef.current = [];
    if (chunks.length === 0) {
      setState('idle');
      toast.info(tToast('noAudio'));
      return;
    }

    setChunkProgress({ done: 0, total: chunks.length });
    let combined = '';
    for (let i = 0; i < chunks.length; i++) {
      try {
        const fd = new FormData();
        fd.append('audio', new Blob([chunks[i]!], { type: 'audio/webm' }), `meeting-${i + 1}.webm`);
        const r = await transcribeAudio(fd);
        const piece = r.text.trim();
        if (piece) combined += (combined ? '\n' : '') + piece;
        setTranscript(combined);
      } catch (err) {
        toast.error(tToast('chunkFailed', { n: i + 1, error: (err as Error).message }));
      } finally {
        setChunkProgress({ done: i + 1, total: chunks.length });
      }
    }
    setChunkProgress(null);
    setState('idle');
    if (combined.trim().length === 0) {
      toast.error(tToast('nothingTranscribed'));
    } else {
      toast.success(tToast('transcribed'));
    }
  }, [stopAllStreams]);

  React.useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const pause = React.useCallback(() => {
    const rec = recRef.current;
    if (!rec || rec.state !== 'recording') return;
    rec.pause();
    pausedAccumRef.current += (Date.now() - startedAtRef.current) / 1000;
    setState('paused');
  }, []);

  const resume = React.useCallback(() => {
    const rec = recRef.current;
    if (!rec || rec.state !== 'paused') return;
    rec.resume();
    startedAtRef.current = Date.now();
    setState('recording');
  }, []);

  const enhance = React.useCallback(async () => {
    if (!transcript.trim() || state !== 'idle') return;
    setState('enhancing');
    try {
      const res = await enhanceMeetingNotes({
        noteId,
        transcript,
        rawNotes,
      });
      setEnhancement(res.markdown);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setState('idle');
    }
  }, [noteId, rawNotes, transcript, state]);

  const acceptEnhancement = React.useCallback(() => {
    if (!enhancement) return;
    onInsertMarkdown(enhancement);
    setEnhancement(null);
    toast.success(tToast('inserted'));
    // Clear the draft now that it's safely in the note.
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setRawNotes('');
    setTranscript('');
  }, [enhancement, draftKey, onInsertMarkdown]);

  const reset = React.useCallback(() => {
    if (state !== 'idle') return;
    if (!confirm(t('confirmDiscard'))) return;
    setRawNotes('');
    setTranscript('');
    setEnhancement(null);
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [state, draftKey]);

  // Stop all media on unmount.
  React.useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      stopAllStreams();
    };
  }, [stopAllStreams]);

  if (!open) return null;

  const recording = state === 'recording';
  const paused = state === 'paused';
  const transcribing = state === 'transcribing';
  const enhancing = state === 'enhancing';
  const busy = recording || paused || transcribing || enhancing;

  return (
    <aside
      className="bg-card flex h-full w-[400px] shrink-0 flex-col border-l"
      data-focus-hide
      aria-label={t('aria.panel')}
    >
      {/* ───────── header ───────── */}
      <header className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex size-2 rounded-full',
              recording && 'animate-pulse bg-red-500',
              paused && 'bg-amber-500',
              !recording && !paused && 'bg-muted-foreground/40',
            )}
            aria-hidden
          />
          <h2 className="text-sm font-medium">{t('label')}</h2>
          {(recording || paused) && (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          aria-label={t('closePanel')}
          disabled={recording || paused}
        >
          <X />
        </Button>
      </header>

      {/* ───────── source toggles (idle only) ───────── */}
      {state === 'idle' && !enhancement && (
        <div className="grid grid-cols-2 gap-2 border-b p-3">
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs',
              includeTab
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
            onClick={() => setIncludeTab((v) => !v)}
            aria-pressed={includeTab}
          >
            <ScreenShare className="size-3.5" />
            {t('sources.tabAudio')}
          </button>
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs',
              includeMic
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
            onClick={() => setIncludeMic((v) => !v)}
            aria-pressed={includeMic}
          >
            {includeMic ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
            {t('sources.microphone')}
          </button>
        </div>
      )}

      {/* ───────── controls ───────── */}
      <div className="flex shrink-0 items-center gap-2 border-b p-3">
        {state === 'idle' && (
          <Button onClick={start} className="flex-1" disabled={!includeMic && !includeTab}>
            <Monitor className="mr-1.5 size-4" />
            {tActions('start')}
          </Button>
        )}
        {recording && (
          <>
            <Button onClick={pause} variant="secondary" className="flex-1">
              <Pause className="mr-1.5 size-4" />
              {tActions('pause')}
            </Button>
            <Button onClick={stop} variant="destructive" className="flex-1">
              <Square className="mr-1.5 size-4" />
              {tActions('stop')}
            </Button>
          </>
        )}
        {paused && (
          <>
            <Button onClick={resume} className="flex-1">
              <Play className="mr-1.5 size-4" />
              {tActions('resume')}
            </Button>
            <Button onClick={stop} variant="destructive" className="flex-1">
              <Square className="mr-1.5 size-4" />
              {tActions('stop')}
            </Button>
          </>
        )}
        {transcribing && (
          <div className="text-muted-foreground flex w-full items-center justify-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin" />
            {tActions('transcribing')}
            {chunkProgress && (
              <span className="tabular-nums">
                {chunkProgress.done}/{chunkProgress.total}
              </span>
            )}
          </div>
        )}
        {enhancing && (
          <div className="text-muted-foreground flex w-full items-center justify-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin" />
            {tActions('enhancing')}
          </div>
        )}
      </div>

      {/* ───────── enhancement preview ───────── */}
      {enhancement && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Sparkles className="text-primary size-3.5" />
              {t('enhanced')}
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEnhancement(null)}>
                {tActions('discard')}
              </Button>
              <Button size="sm" onClick={acceptEnhancement}>
                <CheckCircle2 className="mr-1.5 size-3.5" />
                {tActions('insert')}
              </Button>
            </div>
          </div>
          <pre className="prose prose-sm flex-1 overflow-auto whitespace-pre-wrap p-3 text-sm">
            {enhancement}
          </pre>
        </div>
      )}

      {/* ───────── working area ───────── */}
      {!enhancement && (
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <label className="text-muted-foreground flex items-center justify-between text-[11px] font-medium uppercase tracking-wide">
            <span>{t('rawNotesLabel')}</span>
            <span className="text-muted-foreground/70 normal-case tracking-normal">
              {t('charsSuffix', { count: rawNotes.length })}
            </span>
          </label>
          <Textarea
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            placeholder={t('rawPlaceholder')}
            className="min-h-32 resize-y text-sm"
            disabled={transcribing || enhancing}
          />

          <label className="text-muted-foreground mt-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide">
            <span>{t('transcriptLabel')}</span>
            {transcript && (
              <span className="text-muted-foreground/70 normal-case tracking-normal">
                {t('charsSuffix', { count: transcript.length })}
              </span>
            )}
          </label>
          <div
            className={cn(
              'bg-muted/30 min-h-24 flex-1 overflow-auto rounded-md border p-2.5 text-xs leading-relaxed',
              !transcript && 'text-muted-foreground italic',
            )}
          >
            {transcript || (recording ? t('transcriptRecording') : t('transcriptIdle'))}
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-1">
            <Button
              onClick={enhance}
              disabled={!transcript.trim() || busy}
              className="flex-1"
              variant="default"
            >
              <Sparkles className="mr-1.5 size-4" />
              {tActions('enhancePreview')}
            </Button>
            <Button
              onClick={reset}
              variant="ghost"
              size="icon-sm"
              disabled={busy || (!rawNotes && !transcript)}
              aria-label={tActions('discard')}
              title={tActions('discard')}
            >
              <Trash2 />
            </Button>
          </div>

          {!transcript && rawNotes && state === 'idle' && (
            <p className="text-muted-foreground flex items-start gap-1.5 text-[11px]">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              {t('needAudio')}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
