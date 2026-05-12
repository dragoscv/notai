'use client';
import * as React from 'react';
import { Pin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ViewSpec, type SortKey, DEFAULT_VIEW_SPEC } from '@/lib/view-spec';
import { type SavedView } from '@/server/actions/views';
import { type NoteWithPreview } from '@/components/note/note-card';
import { DashboardViewBar, type DashboardTag } from './dashboard-view-bar';
import { SortableNoteGrid } from './sortable-note-grid';
import type { Folder } from '@notai/db/schema';

const LS_ACTIVE_VIEW = 'notai:dashboard-active-view';

function specsEqual(a: ViewSpec, b: ViewSpec): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Top-level client wrapper for the dashboard. Owns:
 *  - Active view selection (persisted to localStorage; defaults to the
 *    server-flagged default view).
 *  - Live edits to the spec (sort + filters); marks `isDirty` until the
 *    user saves or switches view.
 *  - Triggering a server re-query when the spec changes via a callback
 *    that the parent server component implements with `useFormState` or
 *    a router refresh.
 *
 * For simplicity we apply all filters client-side in this initial pass
 * (the server already returned the user's full note list). This keeps
 * the round-trip cost zero on filter tweaks. If the result set grows
 * beyond a few thousand notes we'll move filters server-side.
 */
export function DashboardView({
  views,
  notes,
  folders,
  tags,
}: {
  views: SavedView[];
  notes: NoteWithPreview[];
  folders: Folder[];
  tags: DashboardTag[];
}) {
  const defaultView = views.find((v) => v.isDefault) ?? views[0]!;

  const [activeId, setActiveId] = React.useState(() => {
    if (typeof window === 'undefined') return defaultView.id;
    const stored = window.localStorage.getItem(LS_ACTIVE_VIEW);
    if (stored && views.some((v) => v.id === stored)) return stored;
    return defaultView.id;
  });

  const baseSpec = views.find((v) => v.id === activeId)?.spec ?? DEFAULT_VIEW_SPEC;
  const [spec, setSpec] = React.useState<ViewSpec>(baseSpec);

  // Reset spec when the active view changes (or when the underlying
  // saved view's spec changes after a save).
  React.useEffect(() => {
    setSpec(baseSpec);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_ACTIVE_VIEW, activeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, JSON.stringify(baseSpec)]);

  const isDirty = !specsEqual(spec, baseSpec);

  // Apply filters + sort client-side over the server-supplied list.
  const filtered = React.useMemo(() => filterAndSort(notes, spec), [notes, spec]);

  const pinned = filtered.filter((n) => n.isPinnedOnToday);
  const rest = filtered.filter((n) => !n.isPinnedOnToday);

  const onSortChangeRequest = (next: SortKey) => {
    setSpec((s) => ({ ...s, sort: next }));
  };

  return (
    <>
      <DashboardViewBar
        views={views}
        activeId={activeId}
        spec={spec}
        isDirty={isDirty}
        onSelectView={setActiveId}
        onChangeSpec={setSpec}
        folders={folders}
        tags={tags}
      />

      <div className="p-6">
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card/60 mx-auto mt-12 max-w-md rounded-2xl border p-8 text-center"
            >
              <p className="font-serif text-lg">No notes match your filters</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Try adjusting the filters or resetting them.
              </p>
              <button
                type="button"
                onClick={() =>
                  setSpec({
                    ...spec,
                    filters: {
                      folderIds: [],
                      tagIds: [],
                      kinds: [],
                      status: [],
                      colors: [],
                      hasCollaborators: undefined,
                      updatedWithin: 'any',
                      search: '',
                    },
                  })
                }
                className="text-primary mt-3 text-sm underline-offset-2 hover:underline"
              >
                Reset filters
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {pinned.length > 0 ? (
                <section className="mb-8">
                  <h2 className="text-muted-foreground mb-3 flex items-center gap-2 text-sm font-medium">
                    <Pin className="size-3.5" /> Pinned on Today
                  </h2>
                  <SortableNoteGrid
                    notes={pinned}
                    sort={spec.sort}
                    onSortChangeRequest={onSortChangeRequest}
                    showTodayPin
                  />
                </section>
              ) : null}

              <section>
                {pinned.length > 0 ? (
                  <h2 className="text-muted-foreground mb-3 text-sm font-medium">Notes</h2>
                ) : null}
                <SortableNoteGrid
                  notes={rest}
                  sort={spec.sort}
                  onSortChangeRequest={onSortChangeRequest}
                />
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function filterAndSort(notes: NoteWithPreview[], spec: ViewSpec): NoteWithPreview[] {
  const f = spec.filters;
  const cutoff = (() => {
    if (f.updatedWithin === 'any') return null;
    const ms =
      f.updatedWithin === 'today'
        ? 24 * 60 * 60 * 1000
        : f.updatedWithin === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;
    return Date.now() - ms;
  })();
  const search = f.search.trim().toLowerCase();

  const filtered = notes.filter((n) => {
    // Default behavior: exclude archived unless explicitly requested.
    if (!f.status.includes('archived') && n.isArchived) return false;
    if (n.deletedAt) return false;

    if (f.status.length > 0) {
      const matchesStatus = f.status.some((s) => {
        if (s === 'pinned') return n.isPinned;
        if (s === 'favorite') return n.isFavorite;
        if (s === 'archived') return n.isArchived;
        if (s === 'pinnedOnToday') return n.isPinnedOnToday;
        return false;
      });
      if (!matchesStatus) return false;
    }

    if (f.kinds.length && !f.kinds.includes(n.kind)) return false;
    if (f.colors.length && !f.colors.includes(n.color ?? 'default')) return false;

    if (f.folderIds.length) {
      const hit = f.folderIds.some((id) => (id === null ? n.folderId === null : n.folderId === id));
      if (!hit) return false;
    }

    if (cutoff !== null && new Date(n.updatedAt).getTime() < cutoff) return false;

    if (search) {
      const haystack = `${n.title} ${n.plaintext}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    // hasCollaborators / tags filters require server data we don't have on
    // the client list; they're applied server-side via `listNotesForView`
    // in a future iteration.
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (spec.pinnedFirst && a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (spec.sort === 'updated')
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (spec.sort === 'created')
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (spec.sort === 'opened') {
      const ao = a.lastOpenedAt
        ? new Date(a.lastOpenedAt).getTime()
        : new Date(a.updatedAt).getTime();
      const bo = b.lastOpenedAt
        ? new Date(b.lastOpenedAt).getTime()
        : new Date(b.updatedAt).getTime();
      return bo - ao;
    }
    if (spec.sort === 'alphabetical') return a.title.localeCompare(b.title);
    // custom
    if (a.position !== b.position) return a.position - b.position;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return sorted;
}
