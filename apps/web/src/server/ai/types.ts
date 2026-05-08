import 'server-only';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelDescriptor {
  /** Stable id used in API calls (e.g. 'gpt-4o-mini'). */
  id: string;
  /** Human-readable name for the picker. */
  name: string;
  /** Supports streaming chat completions. */
  chat?: boolean;
  /** Supports embeddings (vector output). */
  embeddings?: boolean;
  /** Vector dimension for embedding models. */
  dim?: number;
  /** Supports speech-to-text. */
  transcribe?: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount: number;
}

export interface ChatProvider {
  readonly id: 'openai' | 'copilot';
  /** Streaming chat completion. Yields content deltas as plain strings. */
  streamChat(opts: {
    model?: string;
    messages: ChatMessage[];
    temperature?: number;
  }): AsyncGenerator<string, void, void>;
}

export interface EmbeddingProvider {
  readonly id: 'openai' | 'copilot';
  embed(input: string, model?: string): Promise<EmbeddingResult | null>;
}

export interface TranscribeProvider {
  readonly id: 'openai';
  transcribe(file: File, model?: string): Promise<string | null>;
}

export interface ProviderUnavailable {
  reason: 'no-credentials' | 'invalid' | 'feature-unsupported';
  message: string;
}
