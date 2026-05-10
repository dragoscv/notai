import 'server-only';
import { env } from '@notai/lib';
import { getDecryptedSecret, getUserAiPrefs } from './secrets';
import { makeOpenAiChat, makeOpenAiEmbed, makeOpenAiTranscribe } from './openai-provider';
import { makeCopilotChat, makeCopilotEmbed } from './copilot-provider';
import type { ChatProvider, EmbeddingProvider, TranscribeProvider } from './types';

/**
 * Resolve a chat provider for the given user, honoring (in order):
 *   1. User's stored preference (chat_provider + chat_model in user_ai_prefs)
 *   2. Any user-stored credential (Copilot first, then OpenAI BYOK)
 *   3. Server-level OPENAI_API_KEY env var (back-compat / shared deployment)
 *   4. null  → caller should degrade gracefully.
 */
export async function getChatProvider(userId: string | null): Promise<{
  provider: ChatProvider;
  model: string | null;
} | null> {
  if (userId) {
    const prefs = await getUserAiPrefs(userId);
    const preferred = prefs.chat.provider;
    const model = prefs.chat.model;

    // Honor explicit preference
    if (preferred === 'copilot') {
      const sec = await getDecryptedSecret(userId, 'copilot');
      if (sec) return { provider: makeCopilotChat(userId), model };
    }
    if (preferred === 'openai') {
      const sec = await getDecryptedSecret(userId, 'openai');
      if (sec) return { provider: makeOpenAiChat(sec.secret), model };
    }

    // No (working) preference — try any connected provider
    const copilot = await getDecryptedSecret(userId, 'copilot');
    if (copilot) return { provider: makeCopilotChat(userId), model };
    const openai = await getDecryptedSecret(userId, 'openai');
    if (openai) return { provider: makeOpenAiChat(openai.secret), model };
  }

  if (env.OPENAI_API_KEY) {
    return {
      provider: makeOpenAiChat(env.OPENAI_API_KEY),
      model: env.OPENAI_CHAT_MODEL,
    };
  }
  return null;
}

export async function getEmbeddingProvider(userId: string | null): Promise<{
  provider: EmbeddingProvider;
  model: string | null;
} | null> {
  if (userId) {
    const prefs = await getUserAiPrefs(userId);
    const preferred = prefs.embed.provider;
    const model = prefs.embed.model;
    if (preferred === 'copilot') {
      const sec = await getDecryptedSecret(userId, 'copilot');
      if (sec) return { provider: makeCopilotEmbed(userId), model };
    }
    if (preferred === 'openai') {
      const sec = await getDecryptedSecret(userId, 'openai');
      if (sec) return { provider: makeOpenAiEmbed(sec.secret), model };
    }
    // Fall back to any connected provider
    const openai = await getDecryptedSecret(userId, 'openai');
    if (openai) return { provider: makeOpenAiEmbed(openai.secret), model };
    const copilot = await getDecryptedSecret(userId, 'copilot');
    if (copilot) return { provider: makeCopilotEmbed(userId), model };
  }

  if (env.OPENAI_API_KEY) {
    return {
      provider: makeOpenAiEmbed(env.OPENAI_API_KEY),
      model: env.OPENAI_EMBEDDING_MODEL,
    };
  }
  return null;
}

/** Whisper / transcribe is OpenAI-only at the moment. */
export async function getTranscribeProvider(
  userId: string | null,
): Promise<{ provider: TranscribeProvider; model: string | null } | null> {
  if (userId) {
    const prefs = await getUserAiPrefs(userId);
    const model = prefs.transcribe.model;
    const sec = await getDecryptedSecret(userId, 'openai');
    if (sec) return { provider: makeOpenAiTranscribe(sec.secret), model };
  }
  if (env.OPENAI_API_KEY) {
    return {
      provider: makeOpenAiTranscribe(env.OPENAI_API_KEY),
      model: env.OPENAI_WHISPER_MODEL,
    };
  }
  return null;
}

/**
 * Resolve the raw OpenAI API key + Whisper model for the user. Used by
 * the segmented-transcription action to call Whisper directly with
 * `response_format=verbose_json` (which the standard `TranscribeProvider`
 * interface does not surface).
 */
export async function getTranscribeKey(
  userId: string | null,
): Promise<{ apiKey: string; model: string } | null> {
  if (userId) {
    const prefs = await getUserAiPrefs(userId);
    const sec = await getDecryptedSecret(userId, 'openai');
    if (sec)
      return { apiKey: sec.secret, model: prefs.transcribe.model ?? env.OPENAI_WHISPER_MODEL };
  }
  if (env.OPENAI_API_KEY) {
    return { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_WHISPER_MODEL };
  }
  return null;
}
