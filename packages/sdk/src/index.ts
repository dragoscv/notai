/**
 * Official TypeScript client for the Notai REST API.
 *
 * ```ts
 * import { NotaiClient } from '@notai/sdk';
 *
 * const notai = new NotaiClient({ apiKey: process.env.NOTAI_KEY! });
 * const note = await notai.notes.create({ title: 'Hi', plaintext: 'Body' });
 * console.log(note.id);
 * ```
 *
 * Works in Node 22+, Bun, Deno, and modern browsers (uses the
 * platform `fetch`).
 */

export interface NotaiClientOptions {
  apiKey: string;
  /** Override for self-hosted deployments. Defaults to https://notai.app */
  baseUrl?: string;
  /** Optional fetch implementation (mostly for tests). */
  fetch?: typeof fetch;
}

export interface NoteSummary {
  id: string;
  title: string;
  icon: string | null;
  kind: 'note' | 'sticky';
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  title?: string;
  plaintext?: string;
  icon?: string | null;
  folderId?: string | null;
}

export interface UpdateNoteInput {
  title?: string;
  plaintext?: string;
  icon?: string | null;
}

export class NotaiApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'NotaiApiError';
  }
}

export class NotaiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: NotaiClientOptions) {
    if (!opts.apiKey) throw new Error('NotaiClient: apiKey is required');
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? 'https://notai.app').replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? fetch;
  }

  readonly notes = {
    list: async (): Promise<NoteSummary[]> => {
      const data = await this.request<{ notes: NoteSummary[] }>('GET', '/api/v1/notes');
      return data.notes;
    },
    get: async (id: string): Promise<NoteSummary> => {
      const data = await this.request<{ note: NoteSummary }>(
        'GET',
        `/api/v1/notes/${encodeURIComponent(id)}`,
      );
      return data.note;
    },
    create: async (input: CreateNoteInput): Promise<{ id: string; title: string }> =>
      this.request('POST', '/api/v1/notes', input),
    update: async (id: string, input: UpdateNoteInput): Promise<{ note: NoteSummary }> =>
      this.request('PATCH', `/api/v1/notes/${encodeURIComponent(id)}`, input),
    delete: async (id: string): Promise<{ ok: true }> =>
      this.request('DELETE', `/api/v1/notes/${encodeURIComponent(id)}`),
  };

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let message = `${method} ${path} failed (${res.status})`;
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) message = j.error;
      } catch {
        /* keep default */
      }
      throw new NotaiApiError(res.status, message);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
