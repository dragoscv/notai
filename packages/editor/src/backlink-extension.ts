import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions } from '@tiptap/suggestion';

export interface BacklinkOptions {
  /** Returns matching notes for the user's typed query. */
  searchBacklinks: (query: string) => Promise<Array<{ id: string; title: string }>>;
  /**
   * Optional: when the user picks the synthetic “Create ‘query’” entry,
   * the host creates a new note with that title and returns its id. The
   * extension then inserts a normal backlink node pointing at it.
   */
  createBacklink?: (title: string) => Promise<{ id: string; title: string }>;
}

export interface BacklinkSuggestionItem {
  id: string;
  title: string;
  /** When true, this is the synthetic “Create …” row at the bottom. */
  isNew?: boolean;
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
      createBacklink: undefined,
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

function makeSuggestion(): Partial<SuggestionOptions<BacklinkSuggestionItem>> {
  return {
    char: '[[',
    allowSpaces: true,
    startOfLine: false,
    items: async ({ query, editor }) => {
      const opts = editor.extensionManager.extensions.find((e) => e.name === 'backlink')
        ?.options as BacklinkOptions | undefined;
      if (!opts?.searchBacklinks) return [];
      const rows: BacklinkSuggestionItem[] = (await opts.searchBacklinks(query)).slice(0, 8);
      const trimmed = (query ?? '').trim();
      // Offer “Create ‘xxx’” when the typed title doesn’t exactly match an existing one.
      if (
        trimmed &&
        opts.createBacklink &&
        !rows.some((r) => r.title.toLowerCase() === trimmed.toLowerCase())
      ) {
        rows.push({ id: '__new__', title: trimmed, isNew: true });
      }
      return rows;
    },
    command: ({ editor, range, props }) => {
      const opts = editor.extensionManager.extensions.find((e) => e.name === 'backlink')
        ?.options as BacklinkOptions | undefined;
      const insert = (id: string, label: string) => {
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: 'backlink', attrs: { id, label } },
            { type: 'text', text: ' ' },
          ])
          .run();
      };
      if (props.isNew && opts?.createBacklink) {
        // Insert a placeholder immediately so the cursor moves on,
        // then swap it for the real id once the server replies.
        insert('pending', props.title);
        opts
          .createBacklink(props.title)
          .then(({ id, title }) => {
            // Walk the doc to upgrade any “pending” backlink with this label
            // to its real id. Only the most recent matching one is updated.
            const { state, view } = editor;
            let targetFrom: number | null = null;
            state.doc.descendants((node, pos) => {
              if (
                node.type.name === 'backlink' &&
                node.attrs.id === 'pending' &&
                node.attrs.label === title
              ) {
                targetFrom = pos;
              }
            });
            if (targetFrom !== null) {
              const tr = state.tr.setNodeMarkup(targetFrom, undefined, { id, label: title });
              view.dispatch(tr);
            }
          })
          .catch(() => {
            // Best-effort: leave the placeholder; user can retype.
          });
        return;
      }
      insert(props.id, props.title);
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
