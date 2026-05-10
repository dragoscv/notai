'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { streamChat } from '@/server/openai';
import { incrementAiUsage, requireQuota } from '@/server/plans';

const inputSchema = z.object({
  url: z.string().url().max(2048),
});

export interface SmartPasteResult {
  url: string;
  host: string;
  title: string;
  summary: string;
}

const SYSTEM = `You receive raw text scraped from a web page. Your job:
- Extract the page's actual title (drop site-name suffixes like " | Acme").
- Write a 2-4 sentence summary covering the page's substance, not its
  navigation/footer text.

Respond with strict JSON only, no markdown fencing:
{"title":"…","summary":"…"}

If the input is too short or noisy to summarise, respond with:
{"title":"","summary":""}`;

/**
 * Smart paste: given a URL, fetch it, extract the readable text body,
 * and ask the user's BYOK model to produce {title, summary}. The
 * caller (canvas paste handler) drops the result onto the scene as a
 * captioned text element with the source link below it.
 *
 * No persistence — this is a pure transform. Counts toward AI quota.
 */
export async function summariseUrl(input: z.input<typeof inputSchema>): Promise<SmartPasteResult> {
  const { url } = inputSchema.parse(input);
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  await requireQuota(userId, 'ai');

  // Block obvious internal/private targets to avoid SSRF abuse.
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('Only http(s) URLs are supported');
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error('That URL points at a private network address');
  }

  let body: string;
  try {
    const ctrl = AbortSignal.timeout(8000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'NotaiBot/1.0 (+https://notai.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: ctrl,
    });
    if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(ct)) {
      throw new Error('That URL did not return an HTML page');
    }
    body = await res.text();
  } catch (err) {
    throw new Error(`Couldn't fetch the page: ${(err as Error).message}`);
  }

  const text = extractReadableText(body);
  if (text.length < 80) {
    return {
      url,
      host: parsed.hostname,
      title: parsed.hostname,
      summary: '(Page had too little readable text to summarise.)',
    };
  }

  let raw = '';
  for await (const delta of streamChat({
    system: SYSTEM,
    user: `URL: ${url}\nHost: ${parsed.hostname}\n\nPage text (truncated):\n\n${text.slice(0, 9000)}`,
    temperature: 0.2,
    userId,
  })) {
    raw += delta;
  }
  await incrementAiUsage(userId, 1);

  const parsedJson = parseSummaryJson(raw);
  return {
    url,
    host: parsed.hostname,
    title: (parsedJson.title || extractFallbackTitle(body) || parsed.hostname).slice(0, 240),
    summary: parsedJson.summary.slice(0, 800),
  };
}

function parseSummaryJson(raw: string): { title: string; summary: string } {
  const trimmed = raw.trim();
  // Strip code fences if the model added any despite instructions.
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fenced?.[1] ?? trimmed;
  try {
    const obj = JSON.parse(candidate) as Record<string, unknown>;
    const title = typeof obj.title === 'string' ? obj.title : '';
    const summary = typeof obj.summary === 'string' ? obj.summary : '';
    return { title: title.trim(), summary: summary.trim() };
  } catch {
    return { title: '', summary: trimmed.slice(0, 800) };
  }
}

function extractFallbackTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return '';
  return decodeEntities((m[1] ?? '').trim())
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

/**
 * Lightweight readability: strip script/style/nav/header/footer/aside,
 * collapse remaining tags to whitespace, decode common entities. Good
 * enough as LLM input — the model is robust to messy text.
 */
function extractReadableText(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)));
}

function isPrivateHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0' || host === '::1' || host === '[::1]') return true;
  // IPv4 dotted form
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  // IPv6 link-local / ULA
  if (/^fe80:/i.test(host) || /^fc[0-9a-f]{2}:/i.test(host) || /^fd[0-9a-f]{2}:/i.test(host)) {
    return true;
  }
  return false;
}

const OUTLINE_SYSTEM = `Convert the input text into a tight bulleted outline.
- Use \`- \` bullets, max 2 levels deep (indent nested with 2 spaces).
- 5\u201312 top-level bullets total. Be concrete and specific.
- Preserve names, numbers, dates, and verbatim quotes when central.
- Strip filler / repetition. NO preamble, NO trailing summary, just the bullets.`;

/**
 * Smart paste: turn a long pasted blob of text into a clean bulleted
 * outline using the user's AI provider. Counts toward AI quota.
 */
export async function outlinePastedText(text: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  // Hard cap so we don't shoot a novella at the model.
  const trimmed = text.slice(0, 16_000);
  await requireQuota(userId, 'ai');
  const stream = await streamChat({
    system: OUTLINE_SYSTEM,
    user: trimmed,
    temperature: 0.2,
    userId,
  });
  let out = '';
  for await (const delta of stream) out += delta;
  await incrementAiUsage(userId, 1);
  return out.trim();
}
