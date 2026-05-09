'use client';

import { toast } from 'sonner';
import { type QuotaKind, useUpgradeModal } from '@/components/upgrade-modal';

/**
 * Map server-thrown messages back to a typed quota reason.
 *
 * Server actions throw `Error('Quota exceeded: notes (50/50)')` from
 * `requireQuota`, or `Error('PRO_REQUIRED')` from `requirePro`.
 * This util normalises both shapes for the upgrade modal.
 */
export function parseQuotaError(
  err: unknown,
): { kind: QuotaKind; used?: number; limit?: number } | null {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (!msg) return null;
  if (msg === 'PRO_REQUIRED' || /Pro required/i.test(msg)) return { kind: 'pro' };
  const m = /Quota exceeded:\s+(notes|attachments|devices|ai)\s+\((\d+)\/(\d+)\)/i.exec(msg);
  if (m) {
    return {
      kind: m[1] as QuotaKind,
      used: Number(m[2]),
      limit: Number(m[3]),
    };
  }
  return null;
}

/**
 * Hook returning a wrapper that runs a server action and on quota /
 * pro-required errors opens the upgrade modal. All other errors fall
 * through to a toast.
 */
export function useGuardedAction() {
  const upgrade = useUpgradeModal();
  return async function run<T>(
    action: () => Promise<T>,
    opts?: { silent?: boolean },
  ): Promise<T | null> {
    try {
      return await action();
    } catch (err) {
      const q = parseQuotaError(err);
      if (q) {
        upgrade.open({ reason: q.kind, used: q.used, limit: q.limit });
        return null;
      }
      if (!opts?.silent) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
      }
      throw err;
    }
  };
}
