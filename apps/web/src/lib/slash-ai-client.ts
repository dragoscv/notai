'use client';

import type { SlashAiRequest, SlashAiRunner } from '@notai/editor';

/**
 * Client-side fetch wrapper for the slash-AI streaming endpoint. Yields
 * plain text deltas as they arrive. Throws on terminal errors so the
 * `<AiCommandBar />` review state can render a message.
 */
export const runSlashAi: SlashAiRunner = async function* runSlashAi(req, signal) {
  const res = await fetch('/api/ai/slash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req satisfies SlashAiRequest),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = `AI request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let parsed:
        | { type: 'delta'; text: string }
        | { type: 'done' }
        | { type: 'error'; message: string };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (parsed.type === 'delta') {
        yield parsed.text;
      } else if (parsed.type === 'error') {
        throw new Error(parsed.message);
      } else if (parsed.type === 'done') {
        return;
      }
    }
  }
};
