'use server';

import { auth } from '@/auth';
import { db, notes, noteCollaborators, eq, and, or, isNull } from '@notai/db';

/**
 * Lightweight export pipeline. We avoid heavy server-side PDF/DOCX
 * libraries (jspdf, docx, puppeteer) so the build stays cold-start
 * friendly. Instead we ship a print-styled HTML document for PDF
 * (browser \"Save as PDF\") and a Word-compatible HTML payload with a
 * `.doc` extension which Word, Pages, and Google Docs all open as a
 * native document. Fidelity is good enough for plain note exports;
 * future work can add a real renderer behind a feature flag.
 */

async function loadNoteForExport(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;
  const [row] = await db
    .select({
      id: notes.id,
      title: notes.title,
      icon: notes.icon,
      plaintext: notes.plaintext,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .leftJoin(
      noteCollaborators,
      and(eq(noteCollaborators.noteId, notes.id), eq(noteCollaborators.userId, userId)),
    )
    .where(
      and(
        eq(notes.id, noteId),
        isNull(notes.deletedAt),
        or(eq(notes.ownerId, userId), eq(noteCollaborators.userId, userId)),
      ),
    )
    .limit(1);
  if (!row) throw new Error('Note not found');
  return row;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toSafeFilename(title: string): string {
  return (title.trim() || 'note').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
}

/** Returns a print-styled HTML page the client opens in a new tab and prints (Save as PDF). */
export async function exportNotePrintableHtml(
  noteId: string,
): Promise<{ filename: string; html: string }> {
  const row = await loadNoteForExport(noteId);
  const title = row.title?.trim() || 'Untitled';
  const body = (row.plaintext ?? '').trim();
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        max-width: 720px; margin: 48px auto; padding: 0 24px;
        color: #111; line-height: 1.55; font-size: 16px;
      }
      h1 { font-size: 28px; margin: 0 0 6px; }
      .meta { color: #666; font-size: 12px; margin-bottom: 32px; }
      pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; }
      @media print { body { margin: 0; padding: 0 18mm; } @page { margin: 18mm; } }
    </style>
  </head>
  <body>
    <h1>${row.icon ? escapeHtml(row.icon) + ' ' : ''}${escapeHtml(title)}</h1>
    <div class="meta">Updated ${row.updatedAt.toISOString().slice(0, 10)} \u00b7 Notai</div>
    <pre>${escapeHtml(body)}</pre>
    <script>window.addEventListener('load', () => setTimeout(() => window.print(), 200));</script>
  </body>
</html>`;
  return { filename: `${toSafeFilename(title)}.html`, html };
}

/** Returns a Word-openable document (HTML wrapped with the `.doc` extension and an MS-Word XML header). */
export async function exportNoteDoc(
  noteId: string,
): Promise<{ filename: string; content: string; mimeType: string }> {
  const row = await loadNoteForExport(noteId);
  const title = row.title?.trim() || 'Untitled';
  const body = (row.plaintext ?? '').trim();
  // Word-compatible HTML: when served with .doc extension and the
  // "application/msword" mime type, Word, Pages, and Google Docs all
  // import it as an editable document.
  const content = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
    <style>
      body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
      h1 { font-size: 20pt; }
      .meta { color: #666; font-size: 9pt; margin-bottom: 16pt; }
      pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; }
    </style>
  </head>
  <body>
    <h1>${row.icon ? escapeHtml(row.icon) + ' ' : ''}${escapeHtml(title)}</h1>
    <div class="meta">Updated ${row.updatedAt.toISOString().slice(0, 10)} \u00b7 Notai</div>
    <pre>${escapeHtml(body)}</pre>
  </body>
</html>`;
  return {
    filename: `${toSafeFilename(title)}.doc`,
    content,
    mimeType: 'application/msword',
  };
}
