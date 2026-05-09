/**
 * Public AI bridge contract. The editor package never makes network calls;
 * the host app supplies a `runner` that streams text deltas. The runner is
 * threaded through `<TextBlock />` and `<CanvasNote />` so any consumer
 * (web, desktop sticky, future mobile) can plug in its own transport.
 */

export const SLASH_AI_ACTIONS = [
  'write',
  'continue',
  'expand',
  'summarize',
  'rewrite',
  'action-items',
  'improve',
  'translate',
] as const;

export type SlashAiAction = (typeof SLASH_AI_ACTIONS)[number];

export interface SlashAiRequest {
  action: SlashAiAction;
  prompt?: string;
  tone?: string;
  lang?: string;
  selection?: string;
  blockText?: string;
  noteId?: string;
}

export interface SlashAiRunner {
  (req: SlashAiRequest, signal: AbortSignal): AsyncIterable<string>;
}

export interface SlashAiContext {
  /** Streams plain text deltas; throws on terminal error. */
  run: SlashAiRunner;
  /** Optional note id passed to the runner so the server can load context. */
  noteId?: string;
}
