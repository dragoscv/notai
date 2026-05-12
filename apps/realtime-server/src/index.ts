import { Hocuspocus } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import { Database } from '@hocuspocus/extension-database';
import * as Y from 'yjs';
import * as Sentry from '@sentry/node';
import { db, notes, eq, noteCollaborators, and, noteVersions } from '@notai/db';
import { verifyRealtimeToken } from '@notai/lib/jwt';

const PORT = Number(process.env.HOCUSPOCUS_PORT ?? 15601);
const JWT_SECRET = process.env.HOCUSPOCUS_JWT_SECRET;
if (!JWT_SECRET) throw new Error('HOCUSPOCUS_JWT_SECRET is required');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.05,
  });
}

/**
 * In-memory throttle for snapshotting Y.Doc state. We snapshot when:
 *   - the doc has been edited at least N times since the last snapshot, AND
 *   - the last snapshot is older than M minutes.
 */
const SNAPSHOT_EDITS = 25;
const SNAPSHOT_MS = 5 * 60 * 1000;
const editCounts = new Map<string, { edits: number; lastAt: number }>();

/**
 * Hocuspocus realtime server
 * - Authenticates each websocket connection via a JWT issued by the web app
 * - Verifies the user has access to the requested note
 * - Persists Y.Doc state to Postgres on every meaningful change
 */
const server = new Hocuspocus({
  port: PORT,
  /*
   * Persistence cadence.
   *
   * Hocuspocus debounces store calls per-document. Defaults are
   * debounce=2000ms / maxDebounce=10000ms, which means a user who
   * refreshes within 2s of their last edit can read stale state from
   * Postgres on the next cold load even though the change is still
   * live in the server's in-memory Y.Doc (and therefore visible in any
   * other connected window — exactly the "sticky still shows it but
   * the main note went blank after refresh" symptom).
   *
   * 400ms / 2000ms gives us tighter durability with negligible db load
   * (Y updates are tiny binary diffs and a single UPDATE is cheap).
   * Combined with `unloadImmediately: false` we still benefit from
   * coalescing during burst edits without losing recent strokes when
   * the user refreshes.
   */
  debounce: 400,
  maxDebounce: 2000,
  unloadImmediately: false,
  extensions: [
    new Logger({ log: (message: string) => console.log(`[hp] ${message}`) }),
    new Database({
      fetch: async ({ documentName }: { documentName: string }) => {
        const [row] = await db
          .select({ yjsState: notes.yjsState, isEncrypted: notes.isEncrypted })
          .from(notes)
          .where(eq(notes.id, documentName))
          .limit(1);
        // Locked notes never load their Y.Doc on the server — clients
        // already render them via the read-only EncryptedNotePanel.
        if (row?.isEncrypted) return null;
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
        // Skip every write path for encrypted notes: no plaintext
        // mirror, no Y.Doc binary, no version snapshot. The note's
        // canonical content is the client-side ciphertext.
        const [row] = await db
          .select({ isEncrypted: notes.isEncrypted })
          .from(notes)
          .where(eq(notes.id, documentName))
          .limit(1);
        if (row?.isEncrypted) return;

        const plaintext = extractPlaintext(document);
        await db
          .update(notes)
          .set({
            yjsState: state,
            plaintext,
            updatedAt: new Date(),
          })
          .where(eq(notes.id, documentName));

        // Snapshot occasionally so users can roll back.
        const now = Date.now();
        const c = editCounts.get(documentName) ?? { edits: 0, lastAt: 0 };
        c.edits += 1;
        if (c.edits >= SNAPSHOT_EDITS && now - c.lastAt > SNAPSHOT_MS) {
          c.edits = 0;
          c.lastAt = now;
          try {
            await db.insert(noteVersions).values({
              noteId: documentName,
              plaintext: plaintext.slice(0, 100_000),
              yjsState: state,
              sizeBytes: state.byteLength,
            });
          } catch (err) {
            Sentry.captureException(err);
          }
        }
        editCounts.set(documentName, c);
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
  // Canvas-first scene model. Two coexisting shapes:
  //
  //  1. Native Excalidraw (current): doc.getMap('excalidraw').get('elements')
  //     is a JSON array of Excalidraw elements; text elements expose their
  //     copy as `text` / `originalText`. This is the canonical surface
  //     post TipTap removal.
  //
  //  2. Legacy block model (pre-migration): doc.getMap('scene').get('blocks')
  //     points at TipTap fragments under doc.getMap('blocks-content').
  //
  // We walk both so unmigrated notes still mirror plaintext correctly.
  try {
    const parts: string[] = [];

    // (1) Native Excalidraw elements.
    const excaliMap = doc.getMap('excalidraw');
    const rawElements = excaliMap.get('elements');
    if (Array.isArray(rawElements)) {
      for (const el of rawElements as Array<Record<string, unknown>>) {
        if (!el || typeof el !== 'object') continue;
        if (el.isDeleted) continue;
        const text =
          (typeof el.originalText === 'string' && el.originalText) ||
          (typeof el.text === 'string' && el.text) ||
          '';
        const trimmed = text.trim();
        if (trimmed) parts.push(trimmed);
      }
    }

    // (2) Legacy TipTap-via-blocks fragments.
    const scene = doc.getMap('scene');
    const blocks = scene.get('blocks');
    const blockArr =
      blocks && typeof (blocks as { toArray?: unknown }).toArray === 'function'
        ? ((blocks as Y.Array<{ id: string }>).toArray() as Array<{ id: string }>)
        : [];

    const contentMap = doc.getMap('blocks-content');
    for (const block of blockArr) {
      let frag: Y.XmlFragment | null = null;
      if (block.id === '__legacy__') {
        const main = doc.getXmlFragment('default');
        const alt = doc.getXmlFragment('prosemirror');
        frag = main.length > 0 ? main : alt.length > 0 ? alt : main;
      } else {
        const candidate = contentMap.get(block.id);
        if (candidate && typeof (candidate as { toString?: unknown }).toString === 'function') {
          frag = candidate as Y.XmlFragment;
        }
      }
      if (frag) {
        const t = stripXml(frag.toString());
        if (t) parts.push(t);
      }
    }

    if (parts.length === 0) {
      // Unmigrated: read legacy fragments directly.
      for (const name of ['default', 'prosemirror']) {
        const t = stripXml(doc.getXmlFragment(name).toString());
        if (t) parts.push(t);
      }
    }

    return parts.join('\n').slice(0, 100_000);
  } catch {
    return '';
  }
}

function stripXml(xml: string): string {
  if (!xml) return '';
  return xml
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
}
