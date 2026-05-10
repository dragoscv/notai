'use server';

/**
 * Evernote ENEX import — accepts a base64-encoded `.enex` file and
 * creates one note per `<note>` block. Tags inside each note become
 * Notai tags. Attachments (resources) are not imported in this first
 * pass — the user is told how many were skipped so they can re-export
 * via Evernote's per-note "Save attachments" if they want them.
 *
 * No external XML parser: ENEX is regular enough that small, focused
 * regex extraction is reliable, fast, and avoids a dependency.
 */

import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, tags as tagsTable, noteTags, eq, and } from '@notai/db';
import { revalidatePath } from 'next/cache';

const inputSchema = z.object({
  filename: z.string().max(200),
  base64: z.string().max(60 * 1024 * 1024), // 60 MB encoded ≈ 45 MB raw
});

const MAX_NOTES = 1000;
const MAX_NOTE_CHARS = 200_000;

export interface EnexImportSummary {
  notesCreated: number;
  tagsAttached: number;
  resourcesSkipped: number;
  skipped: number;
  errors: string[];
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(s: string): string {
  return s.replace(/&[a-z]+;|&#\d+;/gi, (m) => {
    if (HTML_ENTITIES[m]) return HTML_ENTITIES[m]!;
    const numeric = m.match(/^&#(\d+);$/);
    if (numeric) {
      const code = Number(numeric[1]);
      if (Number.isFinite(code) && code > 0 && code < 0x110000) {
        return String.fromCodePoint(code);
      }
    }
    return m;
  });
}

/**
 * Convert ENML (Evernote's HTML dialect) to a markdown-flavoured
 * plaintext blob. Just enough to preserve paragraphs, lists, and
 * checklists; everything else collapses to text. Good enough for
 * search, FTS embeddings, and the Excalidraw canvas which is plain
 * text anyway.
 */
function enmlToText(html: string): string {
  let s = html;
  // Drop <en-todo /> attributes into checkbox markers.
  s = s.replace(/<en-todo[^>]*\bchecked="true"[^>]*\/?>/gi, '[x] ');
  s = s.replace(/<en-todo[^>]*\/?>/gi, '[ ] ');
  // Block elements → newlines.
  s = s.replace(/<\s*(br|hr)\s*\/?\s*>/gi, '\n');
  s = s.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n');
  // Lists: prefix list items with "- " before stripping tags.
  s = s.replace(/<li[^>]*>/gi, '- ');
  // Drop everything that looks like a tag.
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  // Collapse 3+ newlines, trim trailing whitespace per line.
  s = s
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s.slice(0, MAX_NOTE_CHARS);
}

function pickFirst(s: string, re: RegExp): string | null {
  const m = re.exec(s);
  return m ? (m[1] ?? null) : null;
}

function pickAll(s: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[1] != null) out.push(m[1]);
  }
  return out;
}

export async function importEvernoteEnex(rawInput: {
  filename: string;
  base64: string;
}): Promise<EnexImportSummary> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) throw new Error('Sign in required');
  const userId = user.id;
  const input = inputSchema.parse(rawInput);

  const xml = Buffer.from(input.base64, 'base64').toString('utf8');
  if (!/<en-export[\s>]/i.test(xml)) {
    throw new Error("That doesn't look like an Evernote .enex export.");
  }

  const noteBlocks = xml.match(/<note>[\s\S]*?<\/note>/g) ?? [];
  if (noteBlocks.length > MAX_NOTES) {
    throw new Error(`Too many notes (${noteBlocks.length}); split your export into ≤${MAX_NOTES}.`);
  }

  // Cache: tag-name → tag.id, only created on demand.
  const tagCache = new Map<string, string>();
  async function ensureTag(rawName: string): Promise<string | null> {
    const name = rawName
      .trim()
      .toLowerCase()
      .replace(/^#/, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_\-/]/g, '')
      .slice(0, 80);
    if (!name) return null;
    if (tagCache.has(name)) return tagCache.get(name)!;
    const existing = await db
      .select({ id: tagsTable.id })
      .from(tagsTable)
      .where(and(eq(tagsTable.ownerId, userId), eq(tagsTable.name, name)))
      .limit(1);
    let id: string;
    if (existing[0]) {
      id = existing[0].id;
    } else {
      const [created] = await db
        .insert(tagsTable)
        .values({ ownerId: userId, name })
        .returning({ id: tagsTable.id });
      if (!created) return null;
      id = created.id;
    }
    tagCache.set(name, id);
    return id;
  }

  let notesCreated = 0;
  let tagsAttached = 0;
  let resourcesSkipped = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const block of noteBlocks) {
    try {
      const title = (pickFirst(block, /<title>([\s\S]*?)<\/title>/) ?? 'Imported note')
        .trim()
        .slice(0, 200);
      const contentRaw =
        pickFirst(block, /<content>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/content>/) ??
        pickFirst(block, /<content>([\s\S]*?)<\/content>/) ??
        '';
      const tagsRaw = pickAll(block, /<tag>([\s\S]*?)<\/tag>/g);
      const resources = block.match(/<resource>/g);
      if (resources) resourcesSkipped += resources.length;

      const plaintext = enmlToText(contentRaw);

      const [created] = await db
        .insert(notes)
        .values({
          ownerId: userId,
          title: decodeEntities(title) || 'Imported note',
          plaintext,
          position: Date.now(),
        })
        .returning({ id: notes.id });
      if (!created) {
        skipped += 1;
        continue;
      }
      notesCreated += 1;

      for (const tagRaw of tagsRaw) {
        const tagId = await ensureTag(decodeEntities(tagRaw));
        if (!tagId) continue;
        try {
          await db.insert(noteTags).values({ noteId: created.id, tagId }).onConflictDoNothing();
          tagsAttached += 1;
        } catch {
          /* best-effort */
        }
      }
    } catch (err) {
      errors.push((err as Error).message);
      skipped += 1;
    }
  }

  revalidatePath('/app');
  return {
    notesCreated,
    tagsAttached,
    resourcesSkipped,
    skipped,
    errors: errors.slice(0, 10),
  };
}
