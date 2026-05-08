'use client';
import * as React from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';

interface Item {
  id: string;
  title: string;
}

export interface BacklinkPopoverProps extends SuggestionProps<Item> {}

/**
 * Popover shown while the user is typing inside `[[…`. Keyboard-driven:
 * ↑/↓ to move, Enter to select, Esc to dismiss (handled by the parent).
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
    <div className="bg-card max-w-xs min-w-[220px] rounded-lg border p-1 text-sm shadow-xl">
      {items.length === 0 ? (
        <p className="text-muted-foreground px-3 py-2 text-xs">
          No matching note. Press ↵ to ignore.
        </p>
      ) : (
        items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => select(i)}
            onMouseEnter={() => setActive(i)}
            className={`block w-full truncate rounded px-2 py-1 text-left ${
              i === active ? 'bg-primary/15 text-foreground' : 'text-foreground/85'
            }`}
          >
            <span className="text-muted-foreground mr-1">→</span>
            {it.title || 'Untitled'}
          </button>
        ))
      )}
    </div>
  );
});
