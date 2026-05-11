'use client';

import * as React from 'react';
import { registerPushSubscription } from '@/server/actions/push';

interface RegistrationToken {
  value: string;
}
interface PushApi {
  checkPermissions: () => Promise<{ receive: 'granted' | 'denied' | 'prompt' }>;
  requestPermissions: () => Promise<{ receive: 'granted' | 'denied' | 'prompt' }>;
  register: () => Promise<void>;
  addListener: (
    event: 'registration' | 'registrationError',
    cb: (info: RegistrationToken | { error: string }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
}
interface DeviceApi {
  getId: () => Promise<{ identifier: string }>;
}
interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => 'ios' | 'android' | 'web';
    Plugins?: { PushNotifications?: PushApi; Device?: DeviceApi };
  };
}

/**
 * Native push registration bridge. When running inside the Capacitor
 * shell, requests Notification permission, registers with APNs/FCM,
 * then forwards the resulting device token to `registerPushSubscription`
 * so the server stores it in the unified `push_subscriptions` table
 * (the existing dispatcher in `server/push/dispatch.ts` will then fan
 * out via FCM to both ios and android tokens).
 *
 * No-op on the web. Permission requests run once per device per cold
 * start; users who decline are left alone until they toggle from
 * native Settings.
 */
export function CapacitorPushBridge() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const cap = (window as unknown as CapacitorWindow).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const Push = cap.Plugins?.PushNotifications;
    const Device = cap.Plugins?.Device;
    const platform = cap.getPlatform?.();
    if (!Push || (platform !== 'ios' && platform !== 'android')) return;

    let removeReg: (() => Promise<void>) | null = null;
    let removeErr: (() => Promise<void>) | null = null;

    void (async () => {
      try {
        let perm = await Push.checkPermissions();
        if (perm.receive !== 'granted') {
          perm = await Push.requestPermissions();
        }
        if (perm.receive !== 'granted') return;

        const regHandle = await Push.addListener('registration', (info) => {
          if (!('value' in info)) return;
          const token = info.value;
          void (async () => {
            let deviceId = 'unknown';
            try {
              const d = await Device?.getId();
              deviceId = d?.identifier ?? 'unknown';
            } catch {
              /* ignore */
            }
            try {
              await registerPushSubscription({
                endpoint: token,
                platform,
                deviceId,
                userAgent: `Capacitor ${platform}`,
              });
            } catch {
              /* user might not be signed in yet; retry happens on
                 next cold start via this same bridge */
            }
          })();
        });
        removeReg = () => regHandle.remove();

        const errHandle = await Push.addListener('registrationError', () => {
          /* silently swallow; logged natively */
        });
        removeErr = () => errHandle.remove();

        await Push.register();
      } catch {
        /* plugin not present, native permission denied, or signed
           out — silently no-op */
      }
    })();

    return () => {
      void removeReg?.();
      void removeErr?.();
    };
  }, []);
  return null;
}
