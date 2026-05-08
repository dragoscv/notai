import 'server-only';
import { env } from '@notai/lib';
import type {
  ChatProvider,
  EmbeddingProvider,
  EmbeddingResult,
  ModelDescriptor,
  TranscribeProvider,
} from './types';

const OPENAI_BASE = 'https://api.openai.com/v1';

/**
 * Opinionated curated list of OpenAI models we surface in the picker.
 * Reflects the current snapshot at time of writing — users can still type
 * any model id manually if they need something newer.
 */
export const OPENAI_MODELS: ModelDescriptor[] = [
  { id: 'gpt-4o-mini', name: 'GPT-4o mini (fast, cheap)', chat: true },
  { id: 'gpt-4o', name: 'GPT-4o', chat: true },
  { id: 'gpt-4.1', name: 'GPT-4.1', chat: true },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', chat: true },
  { id: 'o4-mini', name: 'o4-mini (reasoning)', chat: true },
  {
    id: 'text-embedding-3-small',
    name: 'text-embedding-3-small (1536-dim)',
    embeddings: true,
    dim: 1536,
  },
  {
    id: 'text-embedding-3-large',
    name: 'text-embedding-3-large (3072-dim)',
    embeddings: true,
    dim: 3072,
  },
  { id: 'whisper-1', name: 'Whisper v1', transcribe: true },
  { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o mini transcribe', transcribe: true },
];

/**
 * Validate an API key by calling /v1/models. Returns the list of model IDs
 * the key can see (or null if invalid). Used at "save key" time so we can
 * surface a clear error before we ever try to use it.
 */
export async function validateOpenAiKey(
  key: string,
): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${OPENAI_BASE}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `OpenAI rejected the key (${res.status} ${res.statusText}).`,
      };
    }
    const json = (await res.json()) as { data?: { id: string }[] };
    return { ok: true, models: (json.data ?? []).map((m) => m.id) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function makeOpenAiChat(apiKey: string): ChatProvider {
  return {
    id: 'openai',
    async *streamChat({ model, messages, temperature }) {
      const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model ?? env.OPENAI_CHAT_MODEL,
          stream: true,
          temperature: temperature ?? 0.2,
          messages,
        }),
      });
      if (!res.ok || !res.body) {
        yield `Chat error: ${res.status}`;
        return;
      }
      yield* parseSseDeltas(res.body);
    },
  };
}

export function makeOpenAiEmbed(apiKey: string): EmbeddingProvider {
  return {
    id: 'openai',
    async embed(input, model): Promise<EmbeddingResult | null> {
      const trimmed = input.replace(/\s+/g, ' ').trim().slice(0, 6000);
      if (!trimmed) return null;
      const res = await fetch(`${OPENAI_BASE}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: trimmed,
          model: model ?? env.OPENAI_EMBEDDING_MODEL,
        }),
      });
      if (!res.ok) {
        console.error('[openai-embed] error', await res.text());
        return null;
      }
      const json = (await res.json()) as {
        data: { embedding: number[] }[];
        usage: { total_tokens: number };
        model: string;
      };
      const vec = json.data[0]?.embedding;
      if (!vec) return null;
      return {
        embedding: vec,
        model: json.model,
        tokenCount: json.usage.total_tokens,
      };
    },
  };
}

export function makeOpenAiTranscribe(apiKey: string): TranscribeProvider {
  return {
    id: 'openai',
    async transcribe(file, model) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', model ?? env.OPENAI_WHISPER_MODEL);
      fd.append('response_format', 'json');
      const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: fd,
      });
      if (!res.ok) {
        console.error('[openai-transcribe] error', await res.text());
        return null;
      }
      const json = (await res.json()) as { text?: string };
      return json.text ?? null;
    },
  };
}

/** Shared SSE → string-delta async generator (OpenAI-compatible). */
export async function* parseSseDeltas(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data) as {
          choices: { delta?: { content?: string } }[];
        };
        const chunk = json.choices[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch {
        // ignore non-JSON keepalives
      }
    }
  }
}
