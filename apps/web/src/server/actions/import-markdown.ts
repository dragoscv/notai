'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { apiCreateNote } from '@/server/notes-api';
import { revalidatePath } from 'next/cache';

/**
 * Bulk markdown importer. Accepts an array of files (e.g. unzipped
 * Obsidian vault, Notion export folder, plain `.md` set). Each file
 * becomes one note. Frontmatter is parsed for title/icon/tags. Body
 * keeps the rest verbatim — Excalidraw renders it as a text element
 * on first open via the existing plaintext seed flow.
 *
 * Limits: 200 files per call, 1 MiB per file. Caller chunks larger
 * vaults across multiple invocations.
 */

const fileSchema = z.object({
  path: z.string().min(1).max(400),
  content: z.string().max(1_048_576),
});
const importSchema = z.object({
  folderId: z.string().min(1).optional().nullable(),
  files: z.array(fileSchema).min(1).max(200),
});

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importMarkdown(input: z.input<typeof importSchema>): Promise<ImportResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  const { files, folderId } = importSchema.parse(input);

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  for (const f of files) {
    if (!/\.(md|markdown|txt)$/i.test(f.path)) {
      result.skipped += 1;
      continue;
    }
    try {
      const { title, icon, body } = parseMarkdownFile(f);
      await apiCreateNote(userId, {
        title,
        icon,
        plaintext: body,
        folderId: folderId ?? null,
      });
      result.imported += 1;
    } catch (err) {
      result.errors.push(`${f.path}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }
  if (result.imported > 0) revalidatePath('/app');
  return result;
}

function parseMarkdownFile(file: { path: string; content: string }): {
  title: string;
  icon: string | null;
  body: string;
} {
  const baseFromPath = file.path
    .split(/[\\/]/)
    .pop()!
    .replace(/\.(md|markdown|txt)$/i, '')
    .slice(0, 200);

  let body = file.content;
  let icon: string | null = null;
  let title = baseFromPath;

  // YAML frontmatter (Obsidian/Hugo style).
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    const meta = parseFrontmatter(fm[1]!);
    if (typeof meta.title === 'string' && meta.title.trim()) title = meta.title.slice(0, 200);
    if (typeof meta.icon === 'string') icon = meta.icon.slice(0, 8);
    if (typeof meta.emoji === 'string') icon = meta.emoji.slice(0, 8);
    body = body.slice(fm[0].length);
  }

  // If no frontmatter title, prefer first H1.
  const h1 = body.match(/^#\s+(.{1,200})$/m);
  if (h1 && !fm?.[1]?.includes('title:')) title = h1[1]!.trim();

  return { title: title || baseFromPath || 'Untitled', icon, body };
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    let val: string | string[] = m[2]!.trim();
    // Strip surrounding quotes.
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Inline array: [a, b, c]
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
    out[key] = val;
  }
  return out;
}
