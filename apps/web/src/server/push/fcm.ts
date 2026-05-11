import 'server-only';
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { env } from '@notai/lib';

/**
 * Firebase Cloud Messaging primitive for native mobile push (iOS + Android).
 *
 * Web push subscribers (`platform === 'web'`) continue to go through the
 * `web-push` VAPID flow in /api/cron/push-daily-review; this module only
 * handles native mobile tokens stored alongside them in `push_subscriptions`.
 *
 * Initialisation is lazy + idempotent: the first `sendFcm` call parses the
 * service account JSON and registers a singleton Firebase app. Subsequent
 * calls reuse it. Missing env throws — same loud-failure principle as the
 * webhook queue, because a silent no-op would leave users wondering why
 * their phone never rings.
 *
 * Sender payload shape mirrors the web push payload used by
 * /api/cron/push-daily-review so the cron can branch on platform without
 * reshaping data.
 */

let cachedApp: App | null = null;

function getApp(): App {
  if (cachedApp) return cachedApp;
  const projectId = env.FIREBASE_PROJECT_ID;
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!projectId || !raw) {
    throw new Error(
      'FCM is not configured: set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_JSON.',
    );
  }
  // Reuse an existing app if the worker process already initialised one
  // (firebase-admin throws on duplicate initializeApp under the default name).
  const existing = getApps().find((a) => a.name === '[notai-fcm]');
  if (existing) {
    cachedApp = existing;
    return existing;
  }
  let serviceAccount: { project_id?: string; client_email?: string; private_key?: string };
  try {
    serviceAccount = JSON.parse(raw) as typeof serviceAccount;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
  // Vercel env vars often arrive with literal `\n` sequences instead of
  // real newlines in the private key — restore them or jose rejects the PEM.
  if (serviceAccount.private_key && !serviceAccount.private_key.includes('\n')) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  cachedApp = initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail: serviceAccount.client_email ?? '',
        privateKey: serviceAccount.private_key ?? '',
      }),
      projectId,
    },
    '[notai-fcm]',
  );
  return cachedApp;
}

export interface FcmPayload {
  title: string;
  body: string;
  url?: string;
  /** Stable per-notification id so re-sends collapse on the device. */
  tag?: string;
  /** Arbitrary string-only data the client may read. */
  data?: Record<string, string>;
}

export interface FcmSendResult {
  ok: true;
  messageId: string;
}

export interface FcmSendFailure {
  ok: false;
  /** True when the token is permanently invalid (caller should prune the row). */
  permanent: boolean;
  error: string;
}

/**
 * Send a single FCM message. The caller is responsible for pruning the
 * subscription row on `permanent: true` results (mirrors how the web-push
 * cron prunes on 404/410).
 */
export async function sendFcm(
  token: string,
  payload: FcmPayload,
): Promise<FcmSendResult | FcmSendFailure> {
  const message: Message = {
    token,
    notification: { title: payload.title, body: payload.body },
    data: {
      ...(payload.url ? { url: payload.url } : {}),
      ...(payload.tag ? { tag: payload.tag } : {}),
      ...(payload.data ?? {}),
    },
    android: payload.tag ? { collapseKey: payload.tag } : undefined,
    apns: payload.tag ? { headers: { 'apns-collapse-id': payload.tag } } : undefined,
  };
  try {
    const messageId = await getMessaging(getApp()).send(message);
    return { ok: true, messageId };
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    // Tokens become permanently invalid in two well-known cases. Anything
    // else (network blip, quota, etc.) the caller should retry on the next
    // cron tick rather than prune.
    const permanent =
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token';
    return {
      ok: false,
      permanent,
      error: err instanceof Error ? err.message : 'fcm send failed',
    };
  }
}
