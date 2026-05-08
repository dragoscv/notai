'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import {
  deleteUserSecret,
  getDecryptedSecret,
  getUserAiPrefs,
  listCopilotModels,
  listUserSecrets,
  maskKey,
  OPENAI_MODELS,
  pollCopilotDeviceFlow,
  setUserAiPref,
  startCopilotDeviceFlow,
  upsertUserSecret,
  validateOpenAiKey,
  type AiFeature,
  type AiPrefs,
  type AiProvider,
  type DevicePollResult,
  type DeviceFlowStart,
  type ModelDescriptor,
} from '@/server/ai';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  return session.user as { id: string };
}

export interface ConnectedProvider {
  provider: AiProvider;
  label: string | null;
  meta: Record<string, unknown>;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface ProviderStatus {
  connected: ConnectedProvider[];
  prefs: AiPrefs;
}

export async function getProviderStatus(): Promise<ProviderStatus> {
  const me = await requireUser();
  const [secrets, prefs] = await Promise.all([listUserSecrets(me.id), getUserAiPrefs(me.id)]);
  return {
    connected: secrets.map((s) => ({
      provider: s.provider,
      label: (s.meta as { githubLogin?: string }).githubLogin
        ? `GitHub Copilot (${(s.meta as { githubLogin?: string }).githubLogin})`
        : (s.meta as { keyMask?: string }).keyMask
          ? `OpenAI key ${(s.meta as { keyMask?: string }).keyMask}`
          : null,
      meta: s.meta,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
    })),
    prefs,
  };
}

const saveOpenAiSchema = z.object({
  apiKey: z.string().trim().min(20).max(400),
});

export async function saveOpenAiKey(
  input: z.input<typeof saveOpenAiSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireUser();
  const { apiKey } = saveOpenAiSchema.parse(input);
  const validation = await validateOpenAiKey(apiKey);
  if (!validation.ok) return { ok: false, error: validation.error };
  await upsertUserSecret({
    userId: me.id,
    provider: 'openai',
    secret: apiKey,
    meta: { keyMask: maskKey(apiKey), modelCount: validation.models.length },
    label: 'OpenAI',
  });
  revalidatePath('/app/settings/ai-providers');
  return { ok: true };
}

const providerSchema = z.object({
  provider: z.enum(['openai', 'copilot']),
});

export async function disconnectProvider(input: z.input<typeof providerSchema>): Promise<void> {
  const me = await requireUser();
  const { provider } = providerSchema.parse(input);
  await deleteUserSecret(me.id, provider);
  revalidatePath('/app/settings/ai-providers');
}

export async function startCopilotConnection(): Promise<DeviceFlowStart> {
  await requireUser();
  return startCopilotDeviceFlow();
}

const pollSchema = z.object({
  deviceCode: z.string().min(10).max(200),
});

export async function pollCopilotConnection(
  input: z.input<typeof pollSchema>,
): Promise<DevicePollResult> {
  const me = await requireUser();
  const { deviceCode } = pollSchema.parse(input);
  const result = await pollCopilotDeviceFlow(me.id, deviceCode);
  if (result.status === 'connected') {
    revalidatePath('/app/settings/ai-providers');
  }
  return result;
}

const listSchema = z.object({
  provider: z.enum(['openai', 'copilot']),
});

export async function listAvailableModels(
  input: z.input<typeof listSchema>,
): Promise<ModelDescriptor[]> {
  const me = await requireUser();
  const { provider } = listSchema.parse(input);
  if (provider === 'openai') {
    // We could call the live /v1/models endpoint, but the curated list is
    // stable, ordered, and pre-tagged with capabilities for the picker.
    const stored = await getDecryptedSecret(me.id, 'openai');
    if (!stored) return [];
    return OPENAI_MODELS;
  }
  return listCopilotModels(me.id);
}

const prefSchema = z.object({
  feature: z.enum(['chat', 'embed', 'transcribe']),
  provider: z.enum(['openai', 'copilot']).nullable(),
  model: z.string().max(100).nullable(),
});

export async function setModelPreference(input: z.input<typeof prefSchema>): Promise<void> {
  const me = await requireUser();
  const { feature, provider, model } = prefSchema.parse(input);
  await setUserAiPref(
    me.id,
    feature satisfies AiFeature,
    provider,
    model && model.trim() ? model.trim() : null,
  );
  revalidatePath('/app/settings/ai-providers');
}
