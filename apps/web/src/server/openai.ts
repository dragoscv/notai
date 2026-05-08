import 'server-only';
import { getChatProvider, getEmbeddingProvider, type EmbeddingResult } from '@/server/ai';

/**
 * Back-compat facade. Prefer '@/server/ai' for new code — that layer
 * handles provider selection (OpenAI BYOK / GitHub Copilot / server env
 * fallback) and per-feature model preferences.
 */

export async function embedText(
  text: string,
  userId?: string | null,
): Promise<EmbeddingResult | null> {
  const ctx = await getEmbeddingProvider(userId ?? null);
  if (!ctx) return null;
  return ctx.provider.embed(text, ctx.model ?? undefined);
}

export async function* streamChat(opts: {
  system: string;
  user: string;
  temperature?: number;
  userId?: string | null;
}): AsyncGenerator<string, void, void> {
  const ctx = await getChatProvider(opts.userId ?? null);
  if (!ctx) {
    yield 'AI features are not configured. Connect an AI provider under Settings → AI providers.';
    return;
  }
  yield* ctx.provider.streamChat({
    model: ctx.model ?? undefined,
    temperature: opts.temperature,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  });
}

export type { EmbeddingResult };
