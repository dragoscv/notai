import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * Fetch OpenGraph + favicon metadata for an arbitrary URL so the
 * editor can show inline link previews. We do this server-side to
 * dodge CORS, set a tight 4 s timeout, cap the response at 256 KiB,
 * and reject non-http(s) targets so this isn't an SSRF gadget.
 *
 * Cached at the edge for an hour \u2014 the same URL across users hits
 * the same shape, so a single fetch serves many readers.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 4_000;

interface LinkMeta {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

function pick(html: string, re: RegExp): string | undefined {
  const m = html.match(re);
  return m?.[1]?.trim();
}

function absolutise(base: URL, raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const target = req.nextUrl.searchParams.get('url');
  if (!target) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: 'Bad url' }, { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported scheme' }, { status: 400 });
  }
  // Block obvious internal targets to prevent SSRF against private hosts.
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return NextResponse.json({ error: 'Blocked host' }, { status: 400 });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let html = '';
  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'NotaiLinkPreview/1.0 (+https://notai.ro)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
    }
    const reader = res.body?.getReader();
    if (!reader) {
      html = await res.text();
    } else {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let received = 0;
      while (received < MAX_BYTES) {
        const { value, done } = await reader.read();
        if (done) break;
        received += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
    }
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  const meta: LinkMeta = {
    url: parsed.toString(),
    title:
      pick(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
      pick(html, /<title[^>]*>([^<]+)<\/title>/i),
    description:
      pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
      pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i),
    image: absolutise(
      parsed,
      pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i),
    ),
    siteName: pick(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i),
    favicon: `https://www.google.com/s2/favicons?sz=64&domain=${parsed.hostname}`,
  };

  return NextResponse.json(meta, {
    headers: {
      'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
