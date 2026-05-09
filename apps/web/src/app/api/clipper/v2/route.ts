import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { db, notes, assets, eq } from '@notai/db';
import { authenticatePat } from '@/server/pat-auth';
import { buildKey, isAssetsConfigured, presign, publicUrlFor } from '@/server/storage/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SCREENSHOT_MAX = 12 * 1024 * 1024; // 12 MB before base64
const HTML_MAX = 4 * 1024 * 1024; // 4 MB

const bodySchema = z.object({
  /** Required: where the user clipped from. */
  url: z.string().max(2048),
  /** Optional explicit title; if missing we derive one from Readability or the URL. */
  title: z.string().max(300).optional(),
  /** What the extension wants us to do. */
  kind: z.enum(['article', 'selection', 'page-screenshot', 'region-screenshot']),
  /**
   * Full-document outerHTML (for `article`). Server runs Readability +
   * Turndown to produce clean Markdown.
   */
  html: z.string().max(HTML_MAX).optional(),
  /** Plain text selection (for `selection`). */
  selection: z.string().max(60_000).optional(),
  /** PNG base64 (data-URL or raw base64) for screenshot kinds. */
  screenshotPngBase64: z
    .string()
    .max(SCREENSHOT_MAX * 2)
    .optional(),
  /** Optional client capture timestamp; defaults to server time. */
  capturedAt: z.string().datetime().optional(),
});

type Body = z.infer<typeof bodySchema>;

function decodePngBase64(s: string): Buffer | null {
  try {
    const m = /^data:image\/png;base64,(.*)$/i.exec(s);
    const raw = m ? m[1] : s;
    if (!raw) return null;
    const buf = Buffer.from(raw, 'base64');
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    if (
      buf.length < 16 ||
      buf[0] !== 0x89 ||
      buf[1] !== 0x50 ||
      buf[2] !== 0x4e ||
      buf[3] !== 0x47
    ) {
      return null;
    }
    if (buf.length > SCREENSHOT_MAX) return null;
    return buf;
  } catch {
    return null;
  }
}

interface Extracted {
  title: string;
  markdown: string;
  excerpt: string | null;
  byline: string | null;
  siteName: string | null;
  lengthChars: number;
}

function extractArticle(html: string, fallbackUrl: string): Extracted {
  const { document } = parseHTML(html);
  // Strip <script> and <style> proactively — Readability does this internally
  // but doing it up front shrinks the working DOM and avoids edge cases with
  // <script type="application/ld+json"> bodies leaking into textContent.
  for (const el of Array.from(document.querySelectorAll('script,style,noscript,template'))) {
    el.remove();
  }
  const r = new Readability(document as unknown as Document, {
    charThreshold: 200,
  }).parse();
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });
  // Strip tracking-style classes/ids that Turndown would otherwise render.
  td.addRule('strip-tracking', {
    filter: (node) => {
      const el = node as HTMLElement;
      const cls = (el.getAttribute?.('class') ?? '').toLowerCase();
      return /(advert|sponsor|share|social|newsletter|comments?)/.test(cls);
    },
    replacement: () => '',
  });

  const markdown = r?.content ? td.turndown(r.content).trim() : '';
  const title = (r?.title && r.title.trim()) || document.title || fallbackUrl || 'Clipped page';

  return {
    title: title.slice(0, 300),
    markdown,
    excerpt: r?.excerpt ?? null,
    byline: r?.byline ?? null,
    siteName: r?.siteName ?? null,
    lengthChars: r?.length ?? markdown.length,
  };
}

async function uploadScreenshot(
  ownerId: string,
  noteId: string,
  png: Buffer,
): Promise<{ url: string; key: string } | null> {
  if (!isAssetsConfigured()) return null;
  const key = buildKey({
    ownerId,
    noteId,
    filename: `clip-${Date.now()}.png`,
    mime: 'image/png',
  });
  const url = presign({
    method: 'PUT',
    key,
    contentType: 'image/png',
    expiresInSeconds: 300,
  });
  const res = await fetch(url, {
    method: 'PUT',
    body: new Uint8Array(png),
    headers: { 'Content-Type': 'image/png' },
  });
  if (!res.ok) {
    return null;
  }
  return { url: publicUrlFor(key), key };
}

function buildPlaintext(input: {
  url: string;
  kind: Body['kind'];
  extracted: Extracted | null;
  selection: string | null;
  screenshotUrl: string | null;
}): string {
  const parts: string[] = [];
  if (input.url) parts.push(`Source: ${input.url}`);
  if (input.extracted?.byline) parts.push(`By ${input.extracted.byline}`);
  if (input.extracted?.siteName) parts.push(`On ${input.extracted.siteName}`);
  if (input.screenshotUrl) parts.push(`![Screenshot](${input.screenshotUrl})`);
  parts.push('');
  if (input.kind === 'article' && input.extracted) {
    parts.push(input.extracted.markdown || input.extracted.excerpt || '');
  } else if (input.kind === 'selection' && input.selection) {
    parts.push(input.selection);
  } else if (input.kind === 'page-screenshot' || input.kind === 'region-screenshot') {
    if (!input.screenshotUrl) parts.push('(Screenshot upload failed; storage not configured.)');
  }
  return parts.join('\n').trim();
}

/**
 * POST /api/clipper/v2 — improved clipper: server-side Readability for
 * articles, screenshot upload to S3-compatible storage, and a single
 * unified shape. Authenticates via PAT (no cookies).
 */
export async function POST(req: Request) {
  const auth = await authenticatePat(req);
  if (auth instanceof NextResponse) return auth;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  let extracted: Extracted | null = null;
  if (data.kind === 'article') {
    if (!data.html) {
      return NextResponse.json({ error: 'html required for kind=article' }, { status: 400 });
    }
    try {
      extracted = extractArticle(data.html, data.url);
    } catch (err) {
      return NextResponse.json(
        { error: `Readability failed: ${(err as Error).message}` },
        { status: 422 },
      );
    }
  }

  // Decide title: explicit > Readability > URL hostname.
  let title = data.title?.trim() || '';
  if (!title) {
    if (extracted?.title) title = extracted.title;
    else {
      try {
        title = new URL(data.url).hostname || 'Clipped page';
      } catch {
        title = 'Clipped page';
      }
    }
  }
  title = title.slice(0, 300);

  // Insert the note FIRST so we have a stable id for the screenshot key.
  const icon =
    data.kind === 'article'
      ? '📰'
      : data.kind === 'selection'
        ? '✂️'
        : data.kind === 'region-screenshot'
          ? '📸'
          : '🖼️';
  const [row] = await db
    .insert(notes)
    .values({
      ownerId: auth.userId,
      title,
      icon,
      kind: 'note',
      plaintext: '', // filled below
    })
    .returning({ id: notes.id });
  if (!row) {
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
  const noteId = row.id;

  // Upload screenshot if present.
  let screenshotUrl: string | null = null;
  if (
    (data.kind === 'page-screenshot' ||
      data.kind === 'region-screenshot' ||
      data.kind === 'article') &&
    data.screenshotPngBase64
  ) {
    const png = decodePngBase64(data.screenshotPngBase64);
    if (png) {
      const uploaded = await uploadScreenshot(auth.userId, noteId, png);
      if (uploaded) {
        screenshotUrl = uploaded.url;
        await db.insert(assets).values({
          noteId,
          ownerId: auth.userId,
          url: uploaded.url,
          mime: 'image/png',
          sizeBytes: png.length,
        });
      }
    }
  }

  const plaintext = buildPlaintext({
    url: data.url,
    kind: data.kind,
    extracted,
    selection: data.selection ?? null,
    screenshotUrl,
  });
  await db.update(notes).set({ plaintext }).where(eq(notes.id, noteId));

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    id: noteId,
    url: `${origin}/app/n/${noteId}`,
    kind: data.kind,
    title,
    screenshotUrl,
    extracted: extracted
      ? {
          excerpt: extracted.excerpt,
          byline: extracted.byline,
          siteName: extracted.siteName,
          lengthChars: extracted.lengthChars,
        }
      : null,
    ok: true,
  });
}
