import 'server-only';
import {
  getDecryptedSecret,
  updateSecretMeta,
  upsertUserSecret,
} from './secrets';
import { parseSseDeltas } from './openai-provider';
import type {
  ChatProvider,
  EmbeddingProvider,
  EmbeddingResult,
  ModelDescriptor,
} from './types';

/**
 * GitHub Copilot integration via OAuth Device Flow + the Copilot API
 * (api.githubcopilot.com), which is OpenAI-compatible for chat completions
 * and embeddings.
 *
 * We use the well-known GitHub CLI / Copilot client_id `Iv1.b507a08c87ecfe98`
 * which supports the OAuth device authorization grant (RFC 8628). No client
 * secret is required.
 *
 * Token lifecycle:
 *   1. Long-lived `gho_…` GitHub access_token  → stored encrypted in DB.
 *   2. Short-lived (~25 min) Copilot session token  → fetched from
 *      `/copilot_internal/v2/token`, cached in `meta.session.{ token, expiresAt }`.
 */

export const COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const COPILOT_API_BASE = 'https://api.githubcopilot.com';

const COPILOT_HEADERS: Record<string, string> = {
  'Editor-Version': 'Notai/0.1',
  'Editor-Plugin-Version': 'notai-chat/0.1',
  'Copilot-Integration-Id': 'vscode-chat',
  'User-Agent': 'GitHubCopilotChat/0.20.0',
};

export interface DeviceFlowStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

/** Step 1: ask GitHub for a device code. */
export async function startCopilotDeviceFlow(): Promise<DeviceFlowStart> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: COPILOT_CLIENT_ID,
      scope: 'read:user',
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`GitHub device code request failed (${res.status}).`);
  }
  const json = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };
  return {
    deviceCode: json.device_code,
    userCode: json.user_code,
    verificationUri: json.verification_uri,
    expiresIn: json.expires_in,
    interval: Math.max(json.interval ?? 5, 5),
  };
}

export type DevicePollResult =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'connected'; githubLogin: string };

/**
 * Step 2: poll. On success, exchange + store the GitHub token + a fresh
 * Copilot session token in `user_secrets`.
 */
export async function pollCopilotDeviceFlow(
  userId: string,
  deviceCode: string,
): Promise<DevicePollResult> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: COPILOT_CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
    cache: 'no-store',
  });
  const json = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    interval?: number;
  };
  if (json.error === 'authorization_pending') return { status: 'pending' };
  if (json.error === 'slow_down') {
    return { status: 'slow_down', interval: json.interval ?? 10 };
  }
  if (json.error === 'expired_token') return { status: 'expired' };
  if (json.error === 'access_denied') return { status: 'denied' };
  if (!json.access_token) {
    return { status: 'pending' };
  }

  // Got the GitHub access token — verify Copilot subscription + grab login.
  const ghToken = json.access_token;
  const session = await exchangeForCopilotSession(ghToken);
  const login = await fetchGithubLogin(ghToken);

  await upsertUserSecret({
    userId,
    provider: 'copilot',
    secret: ghToken,
    meta: {
      githubLogin: login,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    },
    label: `GitHub Copilot (${login})`,
  });

  return { status: 'connected', githubLogin: login };
}

async function fetchGithubLogin(ghToken: string): Promise<string> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${ghToken}`,
      Accept: 'application/vnd.github+json',
    },
    cache: 'no-store',
  });
  if (!res.ok) return 'github-user';
  const json = (await res.json()) as { login?: string };
  return json.login ?? 'github-user';
}

interface CopilotSession {
  token: string;
  /** Unix epoch seconds */
  expiresAt: number;
}

/**
 * Exchange a GitHub OAuth token for a short-lived Copilot session token.
 * Throws if the user doesn't have an active Copilot subscription.
 */
async function exchangeForCopilotSession(
  ghToken: string,
): Promise<CopilotSession> {
  const res = await fetch(
    'https://api.github.com/copilot_internal/v2/token',
    {
      headers: {
        Authorization: `token ${ghToken}`,
        Accept: 'application/json',
        ...COPILOT_HEADERS,
      },
      cache: 'no-store',
    },
  );
  if (!res.ok) {
    throw new Error(
      `Copilot subscription check failed (${res.status}). Make sure you have an active GitHub Copilot subscription.`,
    );
  }
  const json = (await res.json()) as { token: string; expires_at: number };
  return { token: json.token, expiresAt: json.expires_at };
}

/**
 * Returns a valid Copilot session token, refreshing from the stored GitHub
 * token if the cached one expired (or is within 60s of expiry).
 */
async function getValidCopilotSession(
  userId: string,
): Promise<{ session: CopilotSession; ghToken: string } | null> {
  const stored = await getDecryptedSecret(userId, 'copilot');
  if (!stored) return null;
  const ghToken = stored.secret;
  const cached = (stored.meta as { session?: CopilotSession }).session;
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt > now + 60) {
    return { session: cached, ghToken };
  }
  const fresh = await exchangeForCopilotSession(ghToken);
  await updateSecretMeta(userId, 'copilot', {
    ...stored.meta,
    session: { token: fresh.token, expiresAt: fresh.expiresAt },
  });
  return { session: fresh, ghToken };
}

export async function listCopilotModels(
  userId: string,
): Promise<ModelDescriptor[]> {
  const ctx = await getValidCopilotSession(userId);
  if (!ctx) return [];
  const res = await fetch(`${COPILOT_API_BASE}/models`, {
    headers: {
      Authorization: `Bearer ${ctx.session.token}`,
      ...COPILOT_HEADERS,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('[copilot-models] error', res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as {
    data: Array<{
      id: string;
      name?: string;
      capabilities?: {
        type?: string;
        family?: string;
        supports?: { streaming?: boolean };
      };
      model_picker_enabled?: boolean;
    }>;
  };
  const out: ModelDescriptor[] = [];
  for (const m of json.data ?? []) {
    const type = m.capabilities?.type;
    const isChat = type === 'chat' || type === undefined;
    const isEmbed = type === 'embeddings';
    if (!isChat && !isEmbed) continue;
    out.push({
      id: m.id,
      name: m.name ?? m.id,
      chat: isChat,
      embeddings: isEmbed,
    });
  }
  return out;
}

export function makeCopilotChat(userId: string): ChatProvider {
  return {
    id: 'copilot',
    async *streamChat({ model, messages, temperature }) {
      const ctx = await getValidCopilotSession(userId);
      if (!ctx) {
        yield 'GitHub Copilot is not connected for this account.';
        return;
      }
      const res = await fetch(`${COPILOT_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ctx.session.token}`,
          'Content-Type': 'application/json',
          ...COPILOT_HEADERS,
        },
        body: JSON.stringify({
          model: model ?? 'gpt-4o-mini',
          stream: true,
          temperature: temperature ?? 0.2,
          messages,
        }),
      });
      if (!res.ok || !res.body) {
        yield `Copilot chat error: ${res.status} ${await res.text().catch(() => '')}`;
        return;
      }
      yield* parseSseDeltas(res.body);
    },
  };
}

export function makeCopilotEmbed(userId: string): EmbeddingProvider {
  return {
    id: 'copilot',
    async embed(input, model): Promise<EmbeddingResult | null> {
      const ctx = await getValidCopilotSession(userId);
      if (!ctx) return null;
      const trimmed = input.replace(/\s+/g, ' ').trim().slice(0, 6000);
      if (!trimmed) return null;
      const res = await fetch(`${COPILOT_API_BASE}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ctx.session.token}`,
          'Content-Type': 'application/json',
          ...COPILOT_HEADERS,
        },
        body: JSON.stringify({
          input: trimmed,
          model: model ?? 'text-embedding-3-small',
        }),
      });
      if (!res.ok) {
        console.error('[copilot-embed] error', await res.text());
        return null;
      }
      const json = (await res.json()) as {
        data: { embedding: number[] }[];
        usage?: { total_tokens?: number };
        model: string;
      };
      const vec = json.data[0]?.embedding;
      if (!vec) return null;
      return {
        embedding: vec,
        model: json.model,
        tokenCount: json.usage?.total_tokens ?? 0,
      };
    },
  };
}
