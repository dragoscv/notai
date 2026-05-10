import { randomBytes } from 'node:crypto';
import { db, apiRequestLog } from '@notai/db';

/**
 * Fire-and-forget audit logger for the public REST API. Called from
 * every /api/v1/* handler with the resolved key id, the user id, and
 * the response details. Never throws into the caller — failures are
 * swallowed so a logging hiccup can't 500 a successful API call.
 *
 * Lives in a non-'use server' module so it can be a synchronous
 * export. The matching `getApiKeyUsage` server action is in
 * `api-usage.ts`.
 */
export function logApiRequest(input: {
  apiKeyId: string;
  userId: string;
  path: string;
  method: string;
  status: number;
  durationMs: number;
}): void {
  const id = randomBytes(8).toString('hex');
  void db
    .insert(apiRequestLog)
    .values({ id, ...input })
    .catch(() => {
      /* logging is best-effort */
    });
}
