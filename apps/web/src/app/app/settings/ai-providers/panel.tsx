'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
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

export function AiProvidersPanel({ initialStatus }: Props) {
  const t = useTranslations('settings.pages.aiProviders');
  const FEATURES: { key: FeatureKey; label: string; help: string }[] = [
    { key: 'chat', label: t('featureChat'), help: t('featureChatHelp') },
    { key: 'embed', label: t('featureEmbed'), help: t('featureEmbedHelp') },
    { key: 'transcribe', label: t('featureTranscribe'), help: t('featureTranscribeHelp') },
  ];
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
          {t('crumb')}
        </p>
        <h1 className="font-serif text-3xl">{t('headline')}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">{t('intro')}</p>
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
        features={FEATURES}
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
  const t = useTranslations('settings.pages.aiProviders');
  const [apiKey, setApiKey] = useState('');
  const [pending, startTransition] = useTransition();
  const keyMask = (meta as { keyMask?: string }).keyMask;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {t('openaiTitle')}
              {connected && (
                <Badge variant="secondary" className="font-mono">
                  {t('connected')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {t('openaiDescPrefix')}{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                platform.openai.com/api-keys
              </a>
              {t('openaiDescSuffix')}
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
                  toast.success(t('openaiRemoved'));
                  await onChanged();
                })
              }
            >
              {t('disconnect')}
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
                toast.success(t('openaiSaved'));
                await onChanged();
              });
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="openai-key">{t('apiKeyLabel')}</Label>
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
              {pending ? <Spinner className="size-4" /> : t('saveKey')}
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
  const t = useTranslations('settings.pages.aiProviders');
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
          toast.success(t('connectedAs', { login: result.githubLogin }));
          setDevice(null);
          await onChanged();
          return;
        }
        if (result.status === 'expired' || result.status === 'denied') {
          toast.error(t('connectionStatus', { status: result.status }));
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
            {t('copilotTitle')}
            {connected && (
              <Badge variant="secondary" className="font-mono">
                {t('connected')}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {t('copilotDescPrefix')} <span className="font-mono">github.com/login/device</span>{' '}
            {t('copilotDescSuffix')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>
                {t('signedInAs')} <span className="font-mono">@{login ?? 'github-user'}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await disconnectProvider({ provider: 'copilot' });
                    toast.success(t('copilotDisconnected'));
                    await onChanged();
                  })
                }
              >
                {t('disconnect')}
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
              {pending ? <Spinner className="size-4" /> : t('connectCopilot')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={device !== null} onOpenChange={(o) => !o && setDevice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('authorizeTitle')}</DialogTitle>
            <DialogDescription>{t('authorizeDesc')}</DialogDescription>
          </DialogHeader>
          {device && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg border px-4 py-6 text-center">
                <p className="font-mono text-3xl tracking-[0.4em]">{device.userCode}</p>
              </div>
              <p className="text-muted-foreground text-xs">
                {t('tabClosed')}{' '}
                <a
                  href={device.verificationUri}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {t('clickHere')}
                </a>{' '}
                {t('toOpenManually')}
              </p>
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                {polling && <Spinner className="size-3" />}
                <span>{t('waiting')}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevice(null)}>
              {t('cancel')}
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
  features,
}: {
  prefs: ProviderStatus['prefs'];
  availableProviders: { openai: boolean; copilot: boolean };
  onChanged: () => void | Promise<void>;
  features: { key: FeatureKey; label: string; help: string }[];
}) {
  const t = useTranslations('settings.pages.aiProviders');
  const anyConnected = availableProviders.openai || availableProviders.copilot;
  if (!anyConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('modelPrefsTitle')}</CardTitle>
          <CardDescription>{t('modelPrefsConnect')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('modelPrefsTitle')}</CardTitle>
        <CardDescription>{t('modelPrefsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {features.map((f) => (
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
  const t = useTranslations('settings.pages.aiProviders');
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
      { value: 'auto', label: t('providerAuto') },
    ];
    if (availableProviders.openai) opts.push({ value: 'openai', label: t('providerOpenAi') });
    if (availableProviders.copilot && !transcribeOpenAiOnly) {
      opts.push({ value: 'copilot', label: t('providerCopilot') });
    }
    return opts;
  }, [availableProviders, transcribeOpenAiOnly, t]);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-muted-foreground text-xs">{help}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label={t('providerAria')}
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
          aria-label={t('modelAria')}
          value={model}
          disabled={provider === 'auto' || loadingModels}
          onChange={(e) => setModel(e.target.value)}
          className={cn(
            'border-input bg-background min-w-[260px] flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50',
          )}
        >
          <option value="">
            {provider === 'auto'
              ? t('defaultForProvider')
              : loadingModels
                ? t('loadingModels')
                : filteredModels.length
                  ? t('defaultForProvider')
                  : t('noModels')}
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
              toast.success(t('saved'));
              await onChanged();
            })
          }
        >
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
