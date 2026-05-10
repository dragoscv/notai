import { describe, it, expect } from 'vitest';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Mirror of the receiver-side verification a Notai webhook consumer
 * would write. Validates both authenticity (HMAC-SHA256 over
 * `${timestamp}.${body}`) and freshness (the signed `X-Notai-Timestamp`
 * must be within the receiver's tolerance window — replay protection).
 */
function sign(secret: string, ts: string, body: string): string {
  return createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
}

interface VerifyOpts {
  toleranceSec?: number;
  nowSec?: number;
}

function verify(
  secret: string,
  body: string,
  signatureHeader: string,
  timestampHeader: string,
  opts: VerifyOpts = {},
): boolean {
  const tolerance = opts.toleranceSec ?? 300;
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const ts = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(now - ts) > tolerance) return false;
  const m = /v1=([0-9a-f]+)/i.exec(signatureHeader);
  const provided = (m ? m[1]! : signatureHeader.replace(/^sha256=/i, '')).trim();
  const expected = sign(secret, timestampHeader, body);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}

describe('webhook signature + replay protection', () => {
  const secret = 'whsec_test_eXampleS3cret_0123456789';
  const body = JSON.stringify({
    event: 'note.created',
    deliveredAt: '2025-01-01T00:00:00.000Z',
    data: { id: 'n_abc', title: 'hello' },
  });
  const fixedNow = 1_700_000_000;
  const ts = String(fixedNow);

  it('verifies a fresh, correctly-signed payload', () => {
    const header = `t=${ts},v1=${sign(secret, ts, body)}`;
    expect(verify(secret, body, header, ts, { nowSec: fixedNow })).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const header = `t=${ts},v1=${sign(secret, ts, body)}`;
    expect(verify(secret, body.replace('hello', 'goodbye'), header, ts, { nowSec: fixedNow })).toBe(
      false,
    );
  });

  it('rejects a payload signed with the wrong secret', () => {
    const header = `t=${ts},v1=${sign('whsec_wrong_secret', ts, body)}`;
    expect(verify(secret, body, header, ts, { nowSec: fixedNow })).toBe(false);
  });

  it('rejects an old timestamp (replay)', () => {
    const oldTs = String(fixedNow - 600);
    const header = `t=${oldTs},v1=${sign(secret, oldTs, body)}`;
    expect(verify(secret, body, header, oldTs, { nowSec: fixedNow })).toBe(false);
  });

  it('rejects a timestamp swap (signature was over different ts)', () => {
    const header = `t=${ts},v1=${sign(secret, ts, body)}`;
    const swapped = String(fixedNow + 10);
    expect(verify(secret, body, header, swapped, { nowSec: fixedNow })).toBe(false);
  });

  it('rejects an obviously malformed header', () => {
    expect(verify(secret, body, 't=abc,v1=zz', ts, { nowSec: fixedNow })).toBe(false);
  });
});
