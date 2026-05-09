'use client';
import * as React from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import type { BacklinkSuggestionItem } from './backlink-extension';

export interface BacklinkPopoverProps extends SuggestionProps<BacklinkSuggestionItem> {}

/**
 * Popover shown while the user is typing inside `[[…`. Keyboard-driven:
 * ↑/↓ to move, Enter to select, Esc to dismiss (handled by the parent).
 * The last item may be a synthetic "Create '<title>'" entry — choosing it
 * triggers the host's `createBacklink` callback.
 */
export const BacklinkPopover = React.forwardRef<
  { onKeyDown: (e: KeyboardEvent) => boolean },
  BacklinkPopoverProps
>(function BacklinkPopover(props, ref) {
  const [active, setActive] = React.useState(0);
  const items = props.items;

  React.useEffect(() => {
    setActive(0);
  }, [items]);

  const select = React.useCallback(
    (idx: number) => {
      const item = items[idx];
      if (item) props.command(item);
    },
    [items, props],
  );

  React.useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown') {
        setActive((a) => (items.length === 0 ? 0 : (a + 1) % items.length));
        return true;
      }
      if (e.key === 'ArrowUp') {
        setActive((a) => (items.length === 0 ? 0 : (a - 1 + items.length) % items.length));
        return true;
      }
      if (e.key === 'Enter') {
        select(active);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-card min-w-[240px] max-w-xs rounded-lg border p-1 text-sm shadow-xl">
      {items.length === 0 ? (
        <p className="text-muted-foreground px-3 py-2 text-xs">
          Start typing to find or create a note.
        </p>
      ) : (
        items.map((it, i) => {
          const isActive = i === active;
          if (it.isNew) {
            return (
              <button
                key="__new__"
                type="button"
                onClick={() => select(i)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                  isActive ? 'bg-primary/15 text-foreground' : 'text-foreground/85'
                }`}
              >
                <span className="text-primary">＋</span>
                <span className="min-w-0 flex-1 truncate">
                  Create <span className="font-medium">&ldquo;{it.title}&rdquo;</span>
                </span>
                <span className="text-muted-foreground text-[10px]">↵</span>
              </button>
            );
          }
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => select(i)}
              onMouseEnter={() => setActive(i)}
              className={`block w-full truncate rounded px-2 py-1 text-left ${
                isActive ? 'bg-primary/15 text-foreground' : 'text-foreground/85'
              }`}
            >
              <span className="text-muted-foreground mr-1">→</span>
              {it.title || 'Untitled'}
            </button>
          );
        })
      )}
    </div>
  );
});
