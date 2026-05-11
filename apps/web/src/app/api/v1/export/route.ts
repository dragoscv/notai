import { auth } from '@/auth';
import { db, notes, folders, eq, and, isNull, asc } from '@notai/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Bulk export of every (non-trashed) note the signed-in user owns.
 * Streamed as newline-delimited JSON so it scales to large vaults
 * without buffering the whole dump in memory. Each line after the
 * meta header is a `{ path, content }` record compatible with the
 * markdown importer — copying the file across Notai instances is a
 * true round-trip.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userId = session.user.id;

  const folderRows = await db
    .select({ id: folders.id, name: folders.name })
    .from(folders)
    .where(eq(folders.ownerId, userId));
  const folderById = new Map(folderRows.map((f) => [f.id, f.name]));

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
      folderId: notes.folderId,
      isPinned: notes.isPinned,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), isNull(notes.deletedAt)))
    .orderBy(asc(notes.createdAt));

  const meta = {
    type: 'notai-export-meta',
    version: 1,
    exportedAt: new Date().toISOString(),
    count: rows.length,
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(JSON.stringify(meta) + '\n'));
      for (const r of rows) {
        const folderName = r.folderId ? (folderById.get(r.folderId) ?? null) : null;
        const safeTitle = (r.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
        const folderPath = folderName
          ? folderName.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80) + '/'
          : '';
        const path = `${folderPath}${safeTitle}.md`;

        const fm: string[] = ['---'];
        fm.push(`title: ${JSON.stringify(r.title || 'Untitled')}`);
        if (r.icon) fm.push(`icon: ${JSON.stringify(r.icon)}`);
        if (folderName) fm.push(`folder: ${JSON.stringify(folderName)}`);
        if (r.isPinned) fm.push('pinned: true');
        fm.push(`createdAt: ${r.createdAt.toISOString()}`);
        fm.push(`updatedAt: ${r.updatedAt.toISOString()}`);
        fm.push('---', '');
        const content = `${fm.join('\n')}\n${r.plaintext ?? ''}`;

        controller.enqueue(enc.encode(JSON.stringify({ path, content }) + '\n'));
      }
      controller.close();
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': `attachment; filename="notai-export-${stamp}.ndjson"`,
      'Cache-Control': 'no-store',
    },
  });
}
