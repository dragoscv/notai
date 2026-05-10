import { describe, it, expect } from 'vitest';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Independently re-derive the same HMAC-SHA256 signature that
 * `dispatchNoteEvent` puts in the `X-Notai-Signature` header. This
 * mirrors the receiver-side verification logic any consumer of the
 * webhook would write.
 */
function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function verify(secret: string, body: string, headerValue: string): boolean {
  const expected = sign(secret, body);
  const provided = headerValue.replace(/^sha256=/i, '').trim();
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}

describe('webhook signature verification', () => {
  const secret = 'whsec_test_eXampleS3cret_0123456789';
  const body = JSON.stringify({
    event: 'note.created',
    deliveredAt: '2025-01-01T00:00:00.000Z',
    data: { id: 'n_abc', title: 'hello' },
  });

  it('verifies a correctly-signed payload', () => {
    const header = `sha256=${sign(secret, body)}`;
    expect(verify(secret, body, header)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const header = `sha256=${sign(secret, body)}`;
    const tamperedBody = body.replace('hello', 'goodbye');
    expect(verify(secret, tamperedBody, header)).toBe(false);
  });

  it('rejects a payload signed with the wrong secret', () => {
    const header = `sha256=${sign('whsec_wrong_secret', body)}`;
    expect(verify(secret, body, header)).toBe(false);
  });

  it('accepts header without the sha256= prefix', () => {
    const header = sign(secret, body);
    expect(verify(secret, body, header)).toBe(true);
  });

  it('rejects an obviously malformed header', () => {
    expect(verify(secret, body, 'sha256=zz')).toBe(false);
  });
});
