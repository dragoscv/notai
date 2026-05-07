import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export interface NoteDocHandle {
    doc: Y.Doc;
    provider: HocuspocusProvider;
    local: IndexeddbPersistence;
    destroy: () => void;
}

/**
 * Creates a Y.Doc connected to both:
 * - IndexedDB (offline-first, survives reloads, works without network)
 * - Hocuspocus websocket (realtime sync across devices)
 *
 * The Y.Doc is the single source of truth for editor content AND drawings.
 * TipTap reads from `doc.getXmlFragment('prosemirror')`,
 * tldraw reads from `doc.getMap('tldraw')`.
 */
export function createNoteDoc(params: {
    noteId: string;
    url: string;
    token: string;
    onStatus?: (s: 'connecting' | 'connected' | 'disconnected') => void;
    onSynced?: (synced: boolean) => void;
}): NoteDocHandle {
    const doc = new Y.Doc();

    const local = new IndexeddbPersistence(`notai:${params.noteId}`, doc);

    const provider = new HocuspocusProvider({
        url: params.url,
        name: params.noteId,
        document: doc,
        token: params.token,
        onStatus: ({ status }) => params.onStatus?.(status as 'connecting' | 'connected' | 'disconnected'),
        onSynced: ({ state }) => params.onSynced?.(state),
    });

    const destroy = () => {
        provider.destroy();
        local.destroy();
        doc.destroy();
    };

    return { doc, provider, local, destroy };
}
