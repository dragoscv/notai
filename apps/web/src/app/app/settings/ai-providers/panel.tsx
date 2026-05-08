'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
  cn,
} from '@notai/ui';
import {
  disconnectProvider,
  getProviderStatus,
  listAvailableModels,
  pollCopilotConnection,
  saveOpenAiKey,
  setModelPreference,
  startCopilotConnection,
  type ProviderStatus,
} from '@/server/actions/ai-providers';
import type { ModelDescriptor } from '@/server/ai';

interface Props {
  initialStatus: ProviderStatus;
}

type FeatureKey = 'chat' | 'embed' | 'transcribe';
const FEATURES: { key: FeatureKey; label: string; help: string }[] = [
  {
    key: 'chat',
    label: 'Chat & summarization',
    help: 'Used for "Ask my notes", per-note summaries, action items, rewrites.',
  },
  {
    key: 'embed',
    label: 'Embeddings',
    help: 'Used to vectorize notes for semantic search ("Ask my notes").',
  },
  {
    key: 'transcribe',
    label: 'Voice transcription',
    help: 'Whisper-style speech-to-text for voice notes. OpenAI only today.',
  },
];

export function AiProvidersPanel({ initialStatus }: Props) {
  const [status, setStatus] = useState<ProviderStatus>(initialStatus);
  const isOpenAi = status.connected.some((c) => c.provider === 'openai');
  const isCopilot = status.connected.some((c) => c.provider === 'copilot');

  const refresh = async () => {
    const next = await getProviderStatus();
    setStatus(next);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
          Settings · AI providers
        </p>
        <h1 className="font-serif text-3xl">Bring your own keys</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          Notai never bills you for AI. Connect your own OpenAI account or your existing GitHub
          Copilot subscription, then pick which model should power each feature. Credentials are
          encrypted at rest with AES-256-GCM and only ever decrypted server-side at request time.
        </p>
      </header>

      <OpenAiCard
        connected={isOpenAi}
        onChanged={refresh}
        meta={status.connected.find((c) => c.provider === 'openai')?.meta ?? {}}
      />

      <CopilotCard
        connected={isCopilot}
        onChanged={refresh}
        meta={status.connected.find((c) => c.provider === 'copilot')?.meta ?? {}}
      />

      <ModelPreferences
        prefs={status.prefs}
        availableProviders={{ openai: isOpenAi, copilot: isCopilot }}
        onChanged={refresh}
      />
    </div>
  );
}

// ---------- OpenAI ----------

function OpenAiCard({
  connected,
  meta,
  onChanged,
}: {
  connected: boolean;
  meta: Record<string, unknown>;
  onChanged: () => void | Promise<void>;
}) {
  const [apiKey, setApiKey] = useState('');
  const [pending, startTransition] = useTransition();
  const keyMask = (meta as { keyMask?: string }).keyMask;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              OpenAI
              {connected && (
                <Badge variant="secondary" className="font-mono">
                  Connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Paste a secret key from{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                platform.openai.com/api-keys
              </a>
              . We validate it before saving.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="font-mono text-xs">{keyMask ?? '••••'}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await disconnectProvider({ provider: 'openai' });
                  toast.success('OpenAI key removed.');
                  await onChanged();
                })
              }
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await saveOpenAiKey({ apiKey });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setApiKey('');
                toast.success('OpenAI key saved.');
                await onChanged();
              });
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="openai-key">API key</Label>
              <Input
                id="openai-key"
                type="password"
                autoComplete="off"
                placeholder="sk-…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                minLength={20}
              />
            </div>
            <Button type="submit" disabled={pending || apiKey.length < 20}>
              {pending ? <Spinner className="size-4" /> : 'Save key'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- GitHub Copilot ----------

function CopilotCard({
  connected,
  meta,
  onChanged,
}: {
  connected: boolean;
  meta: Record<string, unknown>;
  onChanged: () => void | Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [device, setDevice] = useState<{
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    interval: number;
  } | null>(null);
  const [polling, setPolling] = useState(false);
  const login = (meta as { githubLogin?: string }).githubLogin;

  // Polling effect — runs while a device modal is open.
  useEffect(() => {
    if (!device) return;
    let cancelled = false;
    setPolling(true);
    const tick = async () => {
      if (cancelled) return;
      try {
        const result = await pollCopilotConnection({
          deviceCode: device.deviceCode,
        });
        if (cancelled) return;
        if (result.status === 'connected') {
          toast.success(`Connected as ${result.githubLogin}.`);
          setDevice(null);
          await onChanged();
          return;
        }
        if (result.status === 'expired' || result.status === 'denied') {
          toast.error(`Connection ${result.status}.`);
          setDevice(null);
          return;
        }
        const wait =
          result.status === 'slow_down' ? result.interval * 1000 : device.interval * 1000;
        setTimeout(tick, wait);
      } catch (err) {
        toast.error((err as Error).message);
        setDevice(null);
      }
    };
    setTimeout(tick, device.interval * 1000);
    return () => {
      cancelled = true;
      setPolling(false);
    };
  }, [device, onChanged]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            GitHub Copilot
            {connected && (
              <Badge variant="secondary" className="font-mono">
                Connected
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Use your existing GitHub Copilot subscription as the LLM provider. We open{' '}
            <span className="font-mono">github.com/login/device</span> in your browser — no client
            secret required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>
                Signed in as <span className="font-mono">@{login ?? 'github-user'}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await disconnectProvider({ provider: 'copilot' });
                    toast.success('GitHub Copilot disconnected.');
                    await onChanged();
                  })
                }
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const d = await startCopilotConnection();
                    setDevice({
                      deviceCode: d.deviceCode,
                      userCode: d.userCode,
                      verificationUri: d.verificationUri,
                      interval: d.interval,
                    });
                    // Auto-open the verification page so the user just needs
                    // to type/paste the user_code.
                    window.open(d.verificationUri, '_blank', 'noopener');
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                })
              }
            >
              {pending ? <Spinner className="size-4" /> : 'Connect GitHub Copilot'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={device !== null} onOpenChange={(o) => !o && setDevice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Authorize Notai on GitHub</DialogTitle>
            <DialogDescription>
              We opened the GitHub authorization page in a new tab. Paste this code there to finish
              connecting.
            </DialogDescription>
          </DialogHeader>
          {device && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg border px-4 py-6 text-center">
                <p className="font-mono text-3xl tracking-[0.4em]">{device.userCode}</p>
              </div>
              <p className="text-muted-foreground text-xs">
                If the tab didn&apos;t open,{' '}
                <a
                  href={device.verificationUri}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  click here
                </a>{' '}
                to open it manually.
              </p>
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                {polling && <Spinner className="size-3" />}
                <span>Waiting for you to authorize…</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevice(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Per-feature model preferences ----------

function ModelPreferences({
  prefs,
  availableProviders,
  onChanged,
}: {
  prefs: ProviderStatus['prefs'];
  availableProviders: { openai: boolean; copilot: boolean };
  onChanged: () => void | Promise<void>;
}) {
  const anyConnected = availableProviders.openai || availableProviders.copilot;
  if (!anyConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model preferences</CardTitle>
          <CardDescription>Connect at least one provider above to choose models.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model preferences</CardTitle>
        <CardDescription>
          Choose which provider + model handles each feature. Leave on Auto to use whatever&apos;s
          connected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {FEATURES.map((f) => (
          <FeatureRow
            key={f.key}
            feature={f.key}
            label={f.label}
            help={f.help}
            current={prefs[f.key]}
            availableProviders={availableProviders}
            transcribeOpenAiOnly={f.key === 'transcribe'}
            onChanged={onChanged}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function FeatureRow({
  feature,
  label,
  help,
  current,
  availableProviders,
  transcribeOpenAiOnly,
  onChanged,
}: {
  feature: FeatureKey;
  label: string;
  help: string;
  current: { provider: 'openai' | 'copilot' | null; model: string | null };
  availableProviders: { openai: boolean; copilot: boolean };
  transcribeOpenAiOnly: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [provider, setProvider] = useState<'auto' | 'openai' | 'copilot'>(
    current.provider ?? 'auto',
  );
  const [model, setModel] = useState<string>(current.model ?? '');
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [pending, startTransition] = useTransition();

  // Load model list whenever provider changes (and is concrete).
  useEffect(() => {
    if (provider === 'auto') {
      setModels([]);
      return;
    }
    setLoadingModels(true);
    listAvailableModels({ provider })
      .then(setModels)
      .finally(() => setLoadingModels(false));
  }, [provider]);

  const filteredModels = useMemo(() => {
    if (feature === 'transcribe') return models.filter((m) => m.transcribe);
    if (feature === 'embed') return models.filter((m) => m.embeddings);
    return models.filter((m) => m.chat);
  }, [models, feature]);

  const providerOptions = useMemo(() => {
    const opts: { value: 'auto' | 'openai' | 'copilot'; label: string }[] = [
      { value: 'auto', label: 'Auto (use any connected)' },
    ];
    if (availableProviders.openai) opts.push({ value: 'openai', label: 'OpenAI' });
    if (availableProviders.copilot && !transcribeOpenAiOnly) {
      opts.push({ value: 'copilot', label: 'GitHub Copilot' });
    }
    return opts;
  }, [availableProviders, transcribeOpenAiOnly]);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-muted-foreground text-xs">{help}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="Provider"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as typeof provider);
            setModel('');
          }}
          className={cn(
            'border-input bg-background min-w-[220px] rounded-md border px-3 py-2 text-sm',
          )}
        >
          {providerOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Model"
          value={model}
          disabled={provider === 'auto' || loadingModels}
          onChange={(e) => setModel(e.target.value)}
          className={cn(
            'border-input bg-background min-w-[260px] flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50',
          )}
        >
          <option value="">
            {provider === 'auto'
              ? 'Default for provider'
              : loadingModels
                ? 'Loading…'
                : filteredModels.length
                  ? 'Default for provider'
                  : 'No matching models found'}
          </option>
          {filteredModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setModelPreference({
                feature,
                provider: provider === 'auto' ? null : provider,
                model: model.trim() ? model : null,
              });
              toast.success('Saved.');
              await onChanged();
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}
