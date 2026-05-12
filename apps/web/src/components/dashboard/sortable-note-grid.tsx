'use client';
import * as React from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@notai/lib/utils';
import { useNoteActions } from '@/components/note/use-note-actions';
import { NoteCard, type NoteWithPreview } from '@/components/note/note-card';
import { SortableNoteCard } from './sortable-note-card';
import { moveNote } from '@/server/actions/notes';
import type { SortKey } from '@/lib/view-spec';

/**
 * Animated, drag-reorderable note grid for the dashboard.
 *
 * - Pointer (desktop): 4 px activation distance, click-to-drag.
 * - Touch (mobile): 250 ms long-press with 8 px tolerance — standard mobile
 *   pattern that doesn't hijack scroll.
 * - Keyboard: arrow keys with sortable coordinates for a11y.
 *
 * When the active sort isn't `custom`, dragging silently switches to
 * custom order (via the `onSortChangeRequest` callback) so the user's
 * drag isn't discarded by an alphabetical sort.
 */
export function SortableNoteGrid({
  notes: initialNotes,
  sort,
  onSortChangeRequest,
  showTodayPin,
  className,
}: {
  notes: NoteWithPreview[];
  sort: SortKey;
  onSortChangeRequest?: (next: SortKey) => void;
  showTodayPin?: boolean;
  className?: string;
}) {
  const t = useTranslations('dashboard.view');
  const actions = useNoteActions();
  // Local order so the grid animates instantly while the server catches up.
  const [items, setItems] = React.useState(initialNotes);
  React.useEffect(() => setItems(initialNotes), [initialNotes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((n) => n.id === active.id);
    const newIndex = items.findIndex((n) => n.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    // Light haptic on supporting devices (iOS Safari ignores).
    try {
      navigator.vibrate?.(10);
    } catch {
      /* ignore */
    }

    if (sort !== 'custom' && onSortChangeRequest) {
      onSortChangeRequest('custom');
      toast.message(t('switchedToCustom'), { duration: 2000 });
    }

    const moved = items[oldIndex]!;
    try {
      await moveNote({ noteId: moved.id, folderId: moved.folderId, index: newIndex });
    } catch (err) {
      toast.error(t('reorderFailed', { error: String(err) }));
      setItems(items); // revert
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((n) => n.id)} strategy={rectSortingStrategy}>
        <motion.div
          layout
          className={cn(
            'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
            className,
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((n) => (
              <actions.ContextMenu key={n.id} note={n}>
                <div>
                  <SortableNoteCard note={n} showTodayPin={showTodayPin}>
                    <NoteCard note={n} />
                  </SortableNoteCard>
                </div>
              </actions.ContextMenu>
            ))}
          </AnimatePresence>
        </motion.div>
      </SortableContext>
      {actions.dialogs}
    </DndContext>
  );
}
