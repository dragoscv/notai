'use server';

/**
 * Workspace import — accepts a base64 zip blob and creates one note per
 * `.md` / `.txt` / `.markdown` file. Folder structure inside the zip
 * is mirrored as Notai folders (created on demand).
 *
 * Limits enforced:
 *  - Max 500 files per import
 *  - Max 1 MB per file (after decompression)
 *  - Max 5 MB total uncompressed
 */

import { unzipSync, strFromU8 } from 'fflate';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, notes, folders, eq, and, isNull } from '@notai/db';
import { revalidatePath } from 'next/cache';

const inputSchema = z.object({
  filename: z.string().max(200),
  base64: z.string().max(20 * 1024 * 1024),
});

const MAX_FILES = 500;
const MAX_FILE_BYTES = 1 * 1024 * 1024;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;
const MD_RE = /\.(md|markdown|txt)$/i;

/**
 * Notion's MD/HTML exporter appends a 32-character hex page id to every
 * filename and folder, e.g. `My Note 1234abcd5678ef90...md`. Strip it
 * for clean titles. Same treatment for folder segments.
 */
const NOTION_HEX_SUFFIX = /[\s\u00A0]+[0-9a-f]{32}$/i;

function cleanNotionName(s: string): string {
  return s.replace(NOTION_HEX_SUFFIX, '').trim();
}

export interface ImportSummary {
  notesCreated: number;
  foldersCreated: number;
  skipped: number;
  errors: string[];
}

export async function importWorkspaceZip(rawInput: {
  filename: string;
  base64: string;
}): Promise<ImportSummary> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) throw new Error('Sign in required');
  const userId = user.id;
  const input = inputSchema.parse(rawInput);

  // Decode base64 → bytes.
  const bin = Buffer.from(input.base64, 'base64');
  if (bin.byteLength > 20 * 1024 * 1024) {
    throw new Error('Zip file is too large (max 20 MB compressed).');
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(bin));
  } catch {
    throw new Error('Could not read that .zip — is it corrupt?');
  }

  const fileNames = Object.keys(entries).filter((n) => !n.endsWith('/'));
  if (fileNames.length > MAX_FILES) {
    throw new Error(`Too many files (got ${fileNames.length}, max ${MAX_FILES}).`);
  }

  // Folder cache: zip path → notai folder id. Empty path = root.
  const folderByPath = new Map<string, string | null>();
  folderByPath.set('', null);
  let foldersCreated = 0;

  async function ensureFolder(zipPath: string): Promise<string | null> {
    if (folderByPath.has(zipPath)) return folderByPath.get(zipPath) ?? null;
    const segments = zipPath.split('/').filter(Boolean);
    let parentId: string | null = null;
    let acc = '';
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      if (folderByPath.has(acc)) {
        parentId = folderByPath.get(acc) ?? null;
        continue;
      }
      // Look up an existing same-named child folder under this parent.
      const existing = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.ownerId, userId),
            eq(folders.name, seg.slice(0, 80)),
            parentId === null ? isNull(folders.parentId) : eq(folders.parentId, parentId),
          ),
        )
        .limit(1);
      let id: string;
      if (existing[0]) {
        id = existing[0].id;
      } else {
        const [created] = await db
          .insert(folders)
          .values({
            ownerId: userId,
            parentId,
            name: seg.slice(0, 80),
            position: Date.now(),
          })
          .returning({ id: folders.id });
        if (!created) throw new Error('Failed to create folder');
        id = created.id;
        foldersCreated += 1;
      }
      folderByPath.set(acc, id);
      parentId = id;
    }
    return parentId;
  }

  let notesCreated = 0;
  let skipped = 0;
  const errors: string[] = [];
  let totalBytes = 0;

  for (const name of fileNames) {
    if (!MD_RE.test(name)) {
      skipped += 1;
      continue;
    }
    const data = entries[name];
    if (!data) {
      skipped += 1;
      continue;
    }
    if (data.byteLength > MAX_FILE_BYTES) {
      errors.push(`${name}: file too large, skipped`);
      skipped += 1;
      continue;
    }
    totalBytes += data.byteLength;
    if (totalBytes > MAX_TOTAL_BYTES) {
      errors.push('Reached the 5 MB total limit; remaining files were skipped.');
      break;
    }

    const segments = name.split('/');
    const fileBase = segments.pop() ?? name;
    const folderPath = segments.map(cleanNotionName).join('/');
    const text = strFromU8(data);
    const cleanedBase = cleanNotionName(fileBase.replace(MD_RE, ''));
    const title = cleanedBase.slice(0, 200) || 'Imported note';
    let folderId: string | null = null;
    try {
      folderId = await ensureFolder(folderPath);
    } catch (err) {
      errors.push(`${name}: ${(err as Error).message}`);
      skipped += 1;
      continue;
    }

    try {
      await db.insert(notes).values({
        ownerId: userId,
        title,
        folderId,
        plaintext: text,
        position: Date.now(),
      });
      notesCreated += 1;
    } catch (err) {
      errors.push(`${name}: ${(err as Error).message}`);
      skipped += 1;
    }
  }

  revalidatePath('/app');
  return { notesCreated, foldersCreated, skipped, errors: errors.slice(0, 10) };
}
