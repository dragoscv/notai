'use client';

import * as React from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import {
  registerPushSubscription,
  unregisterPushSubscription,
  getVapidPublicKey,
} from '@/server/actions/push';

/**
 * Browser-side toggle that asks for Notification permission, registers
 * the push service worker, and persists the resulting `PushSubscription`
 * server-side. Disabled when the deployment has no VAPID public key
 * configured.
 */
export function PushNotificationsToggle() {
  const t = useTranslations('settings.push');
  const [busy, setBusy] = React.useState(false);
  const [subscribed, setSubscribed] = React.useState(false);
  const [supported, setSupported] = React.useState(true);
  const [vapidKey, setVapidKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }
    void getVapidPublicKey().then((k) => setVapidKey(k));
    void navigator.serviceWorker.getRegistration('/sw-push.js').then((reg) => {
      if (!reg) return;
      void reg.pushManager.getSubscription().then((sub) => setSubscribed(Boolean(sub)));
    });
  }, []);

  const onEnable = async () => {
    if (!vapidKey) {
      toast.error(t('notConfiguredToast'));
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast.message(t('permDeclined'));
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw-push.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });
      const j = sub.toJSON();
      await registerPushSubscription({
        endpoint: sub.endpoint,
        p256dh: j.keys?.p256dh ?? '',
        auth: j.keys?.auth ?? '',
        userAgent: navigator.userAgent.slice(0, 400),
      });
      setSubscribed(true);
      toast.success(t('enabled'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('failedEnable'));
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await unregisterPushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.message(t('disabled'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return <p className="text-muted-foreground text-sm">{t('unsupported')}</p>;
  }
  if (!vapidKey) {
    return <p className="text-muted-foreground text-sm">{t('notConfigured')}</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={subscribed ? 'outline' : 'default'}
        disabled={busy}
        onClick={subscribed ? onDisable : onEnable}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : subscribed ? (
          <BellOff className="size-4" />
        ) : (
          <Bell className="size-4" />
        )}
        {subscribed ? t('disable') : t('enable')}
      </Button>
      {subscribed && (
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            try {
              const r = await fetch('/api/push/test', { method: 'POST' });
              if (!r.ok) throw new Error(await r.text());
              const j = (await r.json()) as { sent: number };
              toast.success(
                j.sent === 1 ? t('testSentOne') : t('testSentOther', { count: j.sent }),
              );
            } catch (err) {
              toast.error(err instanceof Error ? err.message : t('testFailed'));
            }
          }}
        >
          {t('sendTest')}
        </Button>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) out[i] = rawData.charCodeAt(i);
  return out;
}
