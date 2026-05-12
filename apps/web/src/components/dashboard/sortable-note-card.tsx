'use client';
import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@notai/lib/utils';
import { NoteCard, type NoteWithPreview } from '@/components/note/note-card';

/**
 * A NoteCard wrapped with `useSortable` for drag-and-drop reordering on
 * the dashboard. The drag handle is hover-only on devices with hover
 * (mouse) and always visible on touch devices (`@media (hover: none)`)
 * so mobile users can long-press the handle to start dragging without
 * hijacking the card's tap-to-open behavior.
 */
export function SortableNoteCard({
  note,
  children,
  showTodayPin,
}: {
  note: NoteWithPreview;
  children?: React.ReactNode;
  showTodayPin?: boolean;
}) {
  const t = useTranslations('dashboard.view');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="relative"
    >
      {/* Today-pin overlay */}
      {showTodayPin && note.isPinnedOnToday ? (
        <span
          aria-hidden
          title={t('pinnedOnTodayTitle')}
          className="bg-primary text-primary-foreground absolute -left-1.5 -top-1.5 z-10 grid size-5 place-items-center rounded-full shadow"
        >
          <Pin className="size-3" />
        </span>
      ) : null}

      {/* Drag handle — hover-only on desktop, always visible on touch. */}
      <button
        type="button"
        aria-label={t('dragLabel')}
        className={cn(
          'bg-card/85 text-muted-foreground hover:text-foreground absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-md border opacity-0 backdrop-blur transition-opacity',
          'focus-visible:opacity-100 group-hover/card:opacity-100',
          // Always-visible on coarse pointers (touch).
          '[@media(hover:none)]:opacity-100',
          isDragging && 'opacity-100',
        )}
        // `touch-none` prevents the browser from interpreting the touch as
        // a scroll once the long-press kicks in. Cursors set per-state.
        style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      <div className="group/card">{children ?? <NoteCard note={note} />}</div>
    </motion.div>
  );
}
