'use client';
import * as React from 'react';
import * as Y from 'yjs';
import { Clock } from 'lucide-react';

interface Props {
  doc: Y.Doc;
}

const WORDS_PER_MINUTE = 220;

/**
 * Live word count + estimated reading time for a note. Reads the
 * Excalidraw scene's text elements directly off the Y.Doc so we don't
 * depend on the server-side `notes.plaintext` cache (which lags by an
 * embed-worker tick). Throttled to once a second to avoid layout
 * thrash on heavy edits.
 */
export function NoteStats({ doc }: Props) {
  const [stats, setStats] = React.useState({ words: 0, minutes: 0 });

  React.useEffect(() => {
    const compute = () => {
      const map = doc.getMap('excalidraw');
      const elements = map.get('elements');
      if (!Array.isArray(elements)) {
        setStats({ words: 0, minutes: 0 });
        return;
      }
      let text = '';
      for (const el of elements as Array<Record<string, unknown>>) {
        if (el && el.type === 'text' && typeof el.text === 'string' && !el.isDeleted) {
          text += ' ' + el.text;
        }
      }
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      setStats({ words, minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)) });
    };
    compute();
    let timer: number | null = null;
    const schedule = () => {
      if (timer != null) return;
      timer = window.setTimeout(() => {
        timer = null;
        compute();
      }, 1000);
    };
    doc.on('update', schedule);
    return () => {
      doc.off('update', schedule);
      if (timer != null) window.clearTimeout(timer);
    };
  }, [doc]);

  if (stats.words === 0) return null;
  return (
    <span
      className="text-muted-foreground inline-flex items-center gap-1 text-xs"
      title={`${stats.words.toLocaleString()} words \u00b7 ~${stats.minutes} min read`}
    >
      <span className="font-mono">{stats.words.toLocaleString()}</span>
      <span>words</span>
      <span aria-hidden>&middot;</span>
      <Clock className="size-3" />
      <span>{stats.minutes}m</span>
    </span>
  );
}
