import { describe, it, expect } from 'vitest';
import { rateLimit, tooManyRequests, getClientIp } from './rate-limit';

describe('rateLimit', () => {
  it('allows up to max requests then blocks', async () => {
    const ns = `t-${Math.random()}`;
    const opts = { name: ns, key: 'a', windowSec: 60, max: 3 };
    expect((await rateLimit(opts)).ok).toBe(true);
    expect((await rateLimit(opts)).ok).toBe(true);
    expect((await rateLimit(opts)).ok).toBe(true);
    const blocked = await rateLimit(opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('isolates buckets per key and per name', async () => {
    const opts1 = { name: 'iso-1', key: 'k1', windowSec: 60, max: 1 };
    const opts2 = { name: 'iso-1', key: 'k2', windowSec: 60, max: 1 };
    const opts3 = { name: 'iso-2', key: 'k1', windowSec: 60, max: 1 };
    expect((await rateLimit(opts1)).ok).toBe(true);
    expect((await rateLimit(opts1)).ok).toBe(false);
    expect((await rateLimit(opts2)).ok).toBe(true);
    expect((await rateLimit(opts3)).ok).toBe(true);
  });

  it('tooManyRequests builds a 429 with Retry-After + reset headers', () => {
    const res = tooManyRequests({
      ok: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      retryAfterSec: 30,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/);
  });
});

describe('getClientIp', () => {
  it('prefers the first x-forwarded-for entry', () => {
    const req = new Request('https://x', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip then cf-connecting-ip then unknown', () => {
    expect(getClientIp(new Request('https://x', { headers: { 'x-real-ip': '9.9.9.9' } }))).toBe(
      '9.9.9.9',
    );
    expect(
      getClientIp(new Request('https://x', { headers: { 'cf-connecting-ip': '7.7.7.7' } })),
    ).toBe('7.7.7.7');
    expect(getClientIp(new Request('https://x'))).toBe('unknown');
  });
});
