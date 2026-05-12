'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { transcribeAudio } from '@/server/actions/transcribe';

interface VoiceRecorderProps {
  /** Called with the final transcript when transcription succeeds. */
  onTranscribed: (text: string) => void;
}

/**
 * Browser-side Voice-to-text. Uses MediaRecorder, posts to a server
 * action that calls Whisper. Designed for ADHD brains: huge button,
 * obvious states, never asks again for permission once granted.
 */
export function VoiceRecorder({ onTranscribed }: VoiceRecorderProps) {
  const t = useTranslations('editor.voice');
  const [state, setState] = React.useState<'idle' | 'recording' | 'transcribing'>('idle');
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  const start = async () => {
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
      setState('recording');
    } catch (err) {
      toast.error(t('micFailed'));
      console.error(err);
    }
  };

  const stop = () => {
    if (recRef.current && state === 'recording') {
      recRef.current.stop();
    }
  };

  const finish = async () => {
    setState('transcribing');
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size < 800) {
        toast.info(t('recorder.tooShort'));
        setState('idle');
        return;
      }
      const fd = new FormData();
      fd.append('audio', blob, 'voice.webm');
      const result = await transcribeAudio(fd);
      onTranscribed(result.text.trim());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setState('idle');
    }
  };

  if (state === 'recording') {
    return (
      <button
        type="button"
        onClick={stop}
        className="bg-destructive text-destructive-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
      >
        <span className="bg-destructive-foreground inline-block size-2 animate-pulse rounded-full" />
        <Square className="size-3.5" /> {t('recorder.stop')}
      </button>
    );
  }
  if (state === 'transcribing') {
    return (
      <div className="text-muted-foreground flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs">
        <Loader2 className="size-3.5 animate-spin" />
        {t('recorder.transcribing')}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={start}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
      title={t('recorder.triggerTitle')}
    >
      <Mic className="size-3.5" /> {t('recorder.trigger')}
    </button>
  );
}
