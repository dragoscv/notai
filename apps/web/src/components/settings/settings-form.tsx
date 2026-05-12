'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Switch } from '@notai/ui/components/switch';
import { Label } from '@notai/ui/components/label';
import { Separator } from '@notai/ui/components/separator';
import { isTauri, invoke } from '@/lib/tauri';

/**
 * Keys we persist via `@tauri-apps/plugin-store`. The Rust side reads
 * `start_minimized` on boot; the rest are read by the web app on demand.
 */
const STORE_FILE = 'settings.json';
const KEY_START_MINIMIZED = 'start_minimized';
const KEY_RESTORE_STICKIES = 'restore_stickies';

interface StoreHandle {
  get<T = unknown>(key: string): Promise<T | null | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

async function loadStore(): Promise<StoreHandle | null> {
  if (!isTauri()) return null;
  const { load } = await import('@tauri-apps/plugin-store');
  return (await load(STORE_FILE, { autoSave: true, defaults: {} })) as unknown as StoreHandle;
}

export function SettingsForm() {
  const t = useTranslations('settings.form');
  const [runAtStartup, setRunAtStartup] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [restoreStickies, setRestoreStickies] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) {
      setError(t('desktopOnly'));
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [autostart, store] = await Promise.all([
          invoke<boolean>('get_autostart'),
          loadStore(),
        ]);
        if (cancelled) return;
        setRunAtStartup(autostart);
        if (store) {
          const sm = await store.get<boolean>(KEY_START_MINIMIZED);
          const rs = await store.get<boolean>(KEY_RESTORE_STICKIES);
          if (cancelled) return;
          setStartMinimized(sm ?? false);
          setRestoreStickies(rs ?? true);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateAutostart = async (enabled: boolean) => {
    setRunAtStartup(enabled);
    try {
      await invoke('set_autostart', { enabled });
    } catch (err) {
      setError(String(err));
      setRunAtStartup(!enabled);
    }
  };

  const updateStoredFlag = async (key: string, value: boolean) => {
    try {
      const store = await loadStore();
      if (!store) return;
      await store.set(key, value);
      await store.save();
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  }
  if (error && !isTauri()) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-muted-foreground text-sm font-medium">{t('startup')}</h2>
        <Row
          id="run-at-startup"
          label={t('runAtStartup')}
          description={t('runAtStartupDesc')}
          checked={runAtStartup}
          onCheckedChange={updateAutostart}
        />
        <Row
          id="start-minimized"
          label={t('startMinimized')}
          description={t('startMinimizedDesc')}
          checked={startMinimized}
          onCheckedChange={(v) => {
            setStartMinimized(v);
            void updateStoredFlag(KEY_START_MINIMIZED, v);
          }}
        />
        <Row
          id="restore-stickies"
          label={t('restoreStickies')}
          description={t('restoreStickiesDesc')}
          checked={restoreStickies}
          onCheckedChange={(v) => {
            setRestoreStickies(v);
            void updateStoredFlag(KEY_RESTORE_STICKIES, v);
          }}
        />
      </section>

      <Separator />

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface RowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function Row({ id, label, description, checked, onCheckedChange }: RowProps) {
  return (
    <div className="bg-card flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="flex-1 space-y-1">
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
