import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions } from '@tiptap/suggestion';

export interface BacklinkOptions {
  /** Returns matching notes for the user's typed query. */
  searchBacklinks: (query: string) => Promise<Array<{ id: string; title: string }>>;
}

/**
 * `[[note]]` autocomplete that inserts a clickable link to another note.
 *
 * Implementation: a configured `@tiptap/extension-mention` with a custom
 * trigger (`[[`), a Tippy-style popover for results, and an HTML node that
 * renders as `<a data-backlink="<id>">title</a>`. Clicking that anchor in
 * read mode navigates to `/app/n/<id>`; the host app wires that on the
 * `EditorContent` container.
 */
export const Backlink = Mention.extend<BacklinkOptions>({
  name: 'backlink',
  addOptions() {
    return {
      ...this.parent?.(),
      searchBacklinks: async () => [],
      HTMLAttributes: {
        class:
          'inline-flex items-center gap-0.5 rounded bg-primary/10 text-primary px-1 underline underline-offset-2 cursor-pointer',
      },
      renderHTML({ options, node }: { options: any; node: any }) {
        return [
          'a',
          {
            ...options.HTMLAttributes,
            href: `/app/n/${node.attrs.id}`,
            'data-backlink': node.attrs.id,
          },
          `${node.attrs.label ?? node.attrs.id}`,
        ];
      },
      suggestion: makeSuggestion(),
    };
  },
}).configure({});

function makeSuggestion(): Partial<SuggestionOptions<{ id: string; title: string }>> {
  return {
    char: '[[',
    allowSpaces: true,
    startOfLine: false,
    items: async ({ query, editor }) => {
      const opts = editor.extensionManager.extensions.find((e) => e.name === 'backlink')
        ?.options as BacklinkOptions | undefined;
      if (!opts?.searchBacklinks) return [];
      const rows = await opts.searchBacklinks(query);
      return rows.slice(0, 8);
    },
    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'backlink',
            attrs: { id: props.id, label: props.title },
          },
          { type: 'text', text: ' ' },
        ])
        .run();
    },
    render: () => {
      let component: ReactRenderer<unknown> | null = null;
      let popup: HTMLElement | null = null;

      const updatePosition = (clientRect?: () => DOMRect | null) => {
        if (!popup || !clientRect) return;
        const rect = clientRect();
        if (!rect) return;
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
      };

      return {
        onStart: (props) => {
          // Lazy-import the React popover to avoid circular deps.
          import('./backlink-popover').then(({ BacklinkPopover }) => {
            component = new ReactRenderer(BacklinkPopover, {
              props,
              editor: props.editor,
            });
            popup = document.createElement('div');
            popup.style.position = 'absolute';
            popup.style.zIndex = '9999';
            popup.appendChild(component.element);
            document.body.appendChild(popup);
            updatePosition(props.clientRect ?? undefined);
          });
        },
        onUpdate: (props) => {
          component?.updateProps(props);
          updatePosition(props.clientRect ?? undefined);
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            popup?.remove();
            component?.destroy();
            return true;
          }
          // Forward to the popover so it can handle ↑↓↵.
          const inner = component?.ref as
            | { onKeyDown?: (e: KeyboardEvent) => boolean }
            | null
            | undefined;
          return inner?.onKeyDown?.(props.event) ?? false;
        },
        onExit: () => {
          popup?.remove();
          component?.destroy();
          component = null;
          popup = null;
        },
      };
    },
  };
}
