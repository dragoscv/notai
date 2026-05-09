'use client';
import * as React from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import {
  Heading1,
  Heading2,
  Heading3,
  Type,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
} from 'lucide-react';
import type { SlashCommand } from './slash-menu-extension';

export type SlashMenuPopoverProps = SuggestionProps<SlashCommand>;

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  paragraph: Type,
  todo: CheckSquare,
  bullet: List,
  ordered: ListOrdered,
  quote: Quote,
  code: Code,
  divider: Minus,
};

const GROUP_LABELS: Record<SlashCommand['group'], string> = {
  basic: 'Basic blocks',
  lists: 'Lists',
  blocks: 'Blocks',
};

export const SlashMenuPopover = React.forwardRef<
  { onKeyDown: (e: KeyboardEvent) => boolean },
  SlashMenuPopoverProps
>(function SlashMenuPopover(props, ref) {
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
      if (e.key === 'Enter' || e.key === 'Tab') {
        select(active);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-card min-w-[260px] rounded-lg border p-3 text-xs shadow-xl">
        <p className="text-muted-foreground">No matching block. Press Esc to dismiss.</p>
      </div>
    );
  }

  // Group items but keep a flat index for keyboard nav.
  const grouped = items.reduce<Record<string, Array<{ item: SlashCommand; flatIndex: number }>>>(
    (acc, item, flatIndex) => {
      const g = item.group;
      acc[g] ??= [];
      acc[g].push({ item, flatIndex });
      return acc;
    },
    {},
  );

  return (
    <div className="bg-card max-h-80 min-w-[280px] overflow-y-auto rounded-lg border p-1 text-sm shadow-xl">
      {(Object.keys(grouped) as SlashCommand['group'][]).map((group) => (
        <div key={group} className="mb-1 last:mb-0">
          <div className="text-muted-foreground px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide">
            {GROUP_LABELS[group]}
          </div>
          {grouped[group]!.map(({ item, flatIndex }) => {
            const Icon = ICONS[item.id] ?? Type;
            const isActive = flatIndex === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => select(flatIndex)}
                onMouseEnter={() => setActive(flatIndex)}
                className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors ${
                  isActive ? 'bg-primary/15 text-foreground' : 'text-foreground/85'
                }`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded border ${
                    isActive ? 'bg-primary/10 border-primary/30' : 'bg-muted/40'
                  }`}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.label}</span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {item.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
