'use server';

/**
 * Bulk export every note the user owns as a single .zip of markdown
 * files. Folder structure is mirrored as zip directory paths.
 *
 * Returns a base64-encoded zip blob \u2014 the client side reconstructs
 * the binary and triggers a download. For accounts with many notes
 * the zip is built in-memory; if size becomes a concern later we can
 * stream via a Route Handler.
 */

import { zipSync, strToU8 } from 'fflate';
import { auth } from '@/auth';
import { db, notes, folders, eq, isNull, and } from '@notai/db';

interface FolderRow {
  id: string;
  parentId: string | null;
  name: string;
}

function buildFolderPath(id: string | null, byId: Map<string, FolderRow>): string {
  if (!id) return '';
  const segments: string[] = [];
  let cur = byId.get(id);
  let safety = 0;
  while (cur && safety < 32) {
    segments.unshift(sanitize(cur.name) || 'folder');
    if (!cur.parentId) break;
    cur = byId.get(cur.parentId);
    safety++;
  }
  return segments.join('/');
}

function sanitize(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .slice(0, 80)
    .trim();
}

export async function exportAllNotesAsZip(): Promise<{
  filename: string;
  base64: string;
  noteCount: number;
}> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) throw new Error('Unauthorized');

  const folderRows = (await db
    .select({ id: folders.id, parentId: folders.parentId, name: folders.name })
    .from(folders)
    .where(eq(folders.ownerId, user.id))) as FolderRow[];
  const byId = new Map(folderRows.map((f) => [f.id, f]));

  const noteRows = await db
    .select({
      id: notes.id,
      title: notes.title,
      plaintext: notes.plaintext,
      folderId: notes.folderId,
    })
    .from(notes)
    .where(and(eq(notes.ownerId, user.id), isNull(notes.deletedAt)));

  // Track filename collisions per folder so two notes with the same
  // title don\u2019t silently overwrite each other in the archive.
  const seenByFolder = new Map<string, Map<string, number>>();

  const archive: Record<string, Uint8Array> = {};
  for (const n of noteRows) {
    const folderPath = buildFolderPath(n.folderId, byId);
    const baseName = sanitize(n.title?.trim() || 'Untitled') || 'note';
    const seen = seenByFolder.get(folderPath) ?? new Map();
    const dupes = (seen.get(baseName) ?? 0) + 1;
    seen.set(baseName, dupes);
    seenByFolder.set(folderPath, seen);
    const filename = dupes === 1 ? `${baseName}.md` : `${baseName} (${dupes}).md`;
    const fullPath = folderPath ? `${folderPath}/${filename}` : filename;
    const title = n.title?.trim() || 'Untitled';
    const body = (n.plaintext ?? '').trim();
    const content = body ? `# ${title}\n\n${body}\n` : `# ${title}\n`;
    archive[fullPath] = strToU8(content);
  }

  // Add a small README at the root so the archive is self-describing.
  archive['README.md'] = strToU8(
    `# Notai export\n\nExported on ${new Date().toISOString()}.\n\nNotes: ${noteRows.length}\nFolders: ${folderRows.length}\n`,
  );

  const zipped = zipSync(archive, { level: 6 });
  // Convert to base64. Buffer is available on the Node runtime which
  // Server Actions use by default.
  const base64 = Buffer.from(zipped).toString('base64');

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    filename: `notai-export-${stamp}.zip`,
    base64,
    noteCount: noteRows.length,
  };
}
