'use client';
import * as React from 'react';
import * as Y from 'yjs';

/**
 * Collaborative title stored in the note's Y.Doc as a Y.Text on the
 * `meta` map. All windows (main, sticky, desktop) see edits in real-time.
 */
export function useSharedTitle(
  doc: Y.Doc | null,
  fallback: string,
): [string, (next: string) => void] {
  const [title, setTitle] = React.useState(fallback);

  React.useEffect(() => {
    if (!doc) return;
    const meta = doc.getMap('meta');
    let text = meta.get('title') as Y.Text | undefined;

    const read = () => {
      const t = meta.get('title') as Y.Text | undefined;
      setTitle(t ? t.toString() : fallback);
    };

    // Seed with the DB fallback if nothing collaborative exists yet.
    if (!text) {
      read();
    } else {
      setTitle(text.toString() || fallback);
    }

    const onMeta = () => {
      text = meta.get('title') as Y.Text | undefined;
      read();
      text?.observe(read);
    };
    meta.observe(onMeta);
    text?.observe(read);

    return () => {
      meta.unobserve(onMeta);
      text?.unobserve(read);
    };
  }, [doc, fallback]);

  const update = React.useCallback(
    (next: string) => {
      setTitle(next);
      if (!doc) return;
      const meta = doc.getMap('meta');
      let text = meta.get('title') as Y.Text | undefined;
      if (!text) {
        const fresh = new Y.Text();
        doc.transact(() => {
          meta.set('title', fresh);
          fresh.insert(0, next);
        });
        return;
      }
      doc.transact(() => {
        const current = text!.toString();
        if (current === next) return;
        text!.delete(0, current.length);
        text!.insert(0, next);
      });
    },
    [doc],
  );

  return [title, update];
}
