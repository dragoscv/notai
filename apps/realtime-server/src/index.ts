import { Hocuspocus } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import { Database } from '@hocuspocus/extension-database';
import * as Y from 'yjs';
import { db, notes, eq, noteCollaborators, and } from '@notai/db';
import { verifyRealtimeToken } from '@notai/lib/jwt';

const PORT = Number(process.env.HOCUSPOCUS_PORT ?? 15601);
const JWT_SECRET = process.env.HOCUSPOCUS_JWT_SECRET;
if (!JWT_SECRET) throw new Error('HOCUSPOCUS_JWT_SECRET is required');

/**
 * Hocuspocus realtime server
 * - Authenticates each websocket connection via a JWT issued by the web app
 * - Verifies the user has access to the requested note
 * - Persists Y.Doc state to Postgres on every meaningful change
 */
const server = new Hocuspocus({
  port: PORT,
  extensions: [
    new Logger({ log: (message: string) => console.log(`[hp] ${message}`) }),
    new Database({
      fetch: async ({ documentName }: { documentName: string }) => {
        const [row] = await db
          .select({ yjsState: notes.yjsState })
          .from(notes)
          .where(eq(notes.id, documentName))
          .limit(1);
        return row?.yjsState ?? null;
      },
      store: async ({
        documentName,
        state,
        document,
      }: {
        documentName: string;
        state: Uint8Array;
        document: Y.Doc;
      }) => {
        const plaintext = extractPlaintext(document);
        await db
          .update(notes)
          .set({
            yjsState: state,
            plaintext,
            updatedAt: new Date(),
          })
          .where(eq(notes.id, documentName));
      },
    }),
  ],

  async onAuthenticate({
    token,
    documentName,
    connection,
  }: {
    token: string;
    documentName: string;
    connection: { readOnly: boolean };
  }) {
    const payload = await verifyRealtimeToken(token, JWT_SECRET!);

    if (payload.noteId !== documentName) {
      throw new Error('Token/document mismatch');
    }

    const [row] = await db
      .select({ ownerId: notes.ownerId })
      .from(notes)
      .where(eq(notes.id, documentName))
      .limit(1);

    if (!row) throw new Error('Note not found');

    const isOwner = row.ownerId === payload.sub;
    let role: 'owner' | 'editor' | 'viewer' = 'viewer';
    if (isOwner) {
      role = 'owner';
    } else {
      const [collab] = await db
        .select({ role: noteCollaborators.role })
        .from(noteCollaborators)
        .where(
          and(
            eq(noteCollaborators.noteId, documentName),
            eq(noteCollaborators.userId, payload.sub),
          ),
        )
        .limit(1);
      if (!collab) throw new Error('Forbidden');
      role = collab.role;
    }

    connection.readOnly = role === 'viewer';

    return {
      user: { id: payload.sub, name: payload.name, email: payload.email, role },
    };
  },
});

await server.listen();
console.log(`✓ Hocuspocus listening on :${PORT}`);

function extractPlaintext(doc: Y.Doc): string {
  try {
    // TipTap Collaboration extension stores content under 'default' by
    // default; older configs used 'prosemirror'. Serialize the fragment
    // and strip tags. Using string form avoids `instanceof Y.XmlText`
    // checks which can fail when multiple yjs copies exist in pnpm.
    for (const name of ['default', 'prosemirror']) {
      const xml = doc.getXmlFragment(name).toString();
      if (!xml) continue;
      const text = xml
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim();
      if (text.length > 0) return text.slice(0, 100_000);
    }
    return '';
  } catch {
    return '';
  }
}
