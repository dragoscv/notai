'use client';
import * as React from 'react';
import { Mic, Square, Loader2, AudioLines } from 'lucide-react';
import { toast } from 'sonner';
import { appendTextToScene, type CanvasNoteHandle } from '@notai/editor';
import { transcribeAudioSegments, type TranscriptSegment } from '@/server/actions/transcribe';

interface VoiceModeButtonProps {
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
}

/** Gap (seconds) between Whisper segments that triggers a paragraph break. */
const PAUSE_THRESHOLD_SEC = 1.4;
/** Hard cap on a single paragraph's character length so a long monologue
 *  still gets split into readable chunks. */
const MAX_PARAGRAPH_CHARS = 480;

/**
 * Voice Mode: hold-to-record a long-form thought, then drop it onto the
 * canvas as separate text elements per natural pause. Pause detection
 * uses Whisper's `verbose_json` segment timestamps — a gap larger than
 * `PAUSE_THRESHOLD_SEC` between segment ends is treated as a paragraph
 * break. ADHD-friendly: one continuous take in, structured paragraphs
 * out, no manual editing.
 */
export function VoiceModeButton({ canvasRef }: VoiceModeButtonProps) {
  const [state, setState] = React.useState<'idle' | 'recording' | 'transcribing'>('idle');
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startedAtRef = React.useRef<number>(0);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (state !== 'recording') return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [state]);

  const finish = React.useCallback(async () => {
    setState('transcribing');
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size < 800) {
        toast.info('Recording was too short.');
        setState('idle');
        return;
      }
      const fd = new FormData();
      fd.append('audio', blob, 'voice-mode.webm');
      const result = await transcribeAudioSegments(fd);

      const api = canvasRef.current?.getExcalidrawApi();
      if (!api) {
        toast.error('Canvas not ready — copying transcript to clipboard instead.');
        try {
          await navigator.clipboard.writeText(result.text);
        } catch {
          /* ignore */
        }
        return;
      }

      const paragraphs = groupSegmentsIntoParagraphs(result.segments, result.text);
      if (paragraphs.length === 0) {
        toast.info('Nothing audible to transcribe.');
        return;
      }
      for (const p of paragraphs) {
        appendTextToScene(api, p, { focus: false });
      }
      // Focus the last paragraph so the user lands on what they just said.
      appendTextToScene(api, '', { focus: true }); // no-op for empty
      toast.success(
        `Voice mode: ${paragraphs.length} paragraph${paragraphs.length === 1 ? '' : 's'}.`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setState('idle');
    }
  }, [canvasRef]);

  const start = React.useCallback(async () => {
    if (state !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      startedAtRef.current = Date.now();
      setElapsed(0);
      setState('recording');
    } catch (err) {
      toast.error("Couldn't access your microphone");
      console.error(err);
    }
  }, [state, finish]);

  const stop = () => {
    if (recRef.current && state === 'recording') {
      recRef.current.stop();
    }
  };

  if (state === 'recording') {
    return (
      <button
        type="button"
        onClick={stop}
        className="bg-destructive text-destructive-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
        title="Stop recording"
      >
        <span className="bg-destructive-foreground inline-block size-2 animate-pulse rounded-full" />
        <Square className="size-3.5" />
        <span className="font-mono">{formatElapsed(elapsed)}</span>
      </button>
    );
  }
  if (state === 'transcribing') {
    return (
      <div className="text-muted-foreground flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs">
        <Loader2 className="size-3.5 animate-spin" />
        Splitting paragraphs…
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={start}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
      title="Voice mode — record a long thought and let Notai split it into paragraphs by pause"
    >
      <AudioLines className="size-3.5" /> <Mic className="size-3.5" />
      Voice mode
    </button>
  );
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Group Whisper segments into paragraphs by silence gaps. Falls back
 * to splitting the joined transcript on sentence boundaries if Whisper
 * didn't return segment timestamps (rare — happens when the model is
 * older than gpt-4o-transcribe).
 */
function groupSegmentsIntoParagraphs(
  segments: TranscriptSegment[],
  fallbackText: string,
): string[] {
  if (segments.length === 0) return paragraphsFromPlaintext(fallbackText);

  const out: string[] = [];
  let buf: string[] = [];
  let bufLen = 0;
  let prevEnd = segments[0]!.end;
  buf.push(segments[0]!.text);
  bufLen += segments[0]!.text.length;

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]!;
    const gap = seg.start - prevEnd;
    const wouldOverflow = bufLen + seg.text.length + 1 > MAX_PARAGRAPH_CHARS;
    if (gap >= PAUSE_THRESHOLD_SEC || wouldOverflow) {
      const para = buf.join(' ').replace(/\s+/g, ' ').trim();
      if (para) out.push(para);
      buf = [];
      bufLen = 0;
    }
    buf.push(seg.text);
    bufLen += seg.text.length + 1;
    prevEnd = seg.end;
  }
  const last = buf.join(' ').replace(/\s+/g, ' ').trim();
  if (last) out.push(last);
  return out;
}

function paragraphsFromPlaintext(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  // Split on existing line breaks first, then split overly-long paragraphs
  // on sentence boundaries.
  const rough = t
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of rough) {
    if (p.length <= MAX_PARAGRAPH_CHARS) {
      out.push(p);
      continue;
    }
    const sentences = p.split(/(?<=[.!?])\s+/);
    let cur = '';
    for (const s of sentences) {
      if ((cur + ' ' + s).trim().length > MAX_PARAGRAPH_CHARS) {
        if (cur.trim()) out.push(cur.trim());
        cur = s;
      } else {
        cur = (cur + ' ' + s).trim();
      }
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}
