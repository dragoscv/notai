import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleBlock: {
      setToggleBlock: () => ReturnType;
      toggleToggleBlock: () => ReturnType;
      toggleToggleOpen: () => ReturnType;
    };
  }
}

/**
 * Notion-style collapsible block. Two children:
 *   - `toggleSummary`  (1 inline summary line)
 *   - `toggleContent`  (block+ — hidden when `open: false`)
 * Open state is stored on the parent node so collaborators see the same
 * folded/unfolded state. The chevron is a contenteditable=false span.
 */
export const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'toggleSummary toggleContent',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el) => el.getAttribute('data-open') !== 'false',
        renderHTML: (attrs) => ({ 'data-open': attrs.open ? 'true' : 'false' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-toggle-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-toggle-block': '',
        class: 'tiptap-toggle',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setToggleBlock:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { open: true },
            content: [
              { type: 'toggleSummary', content: [{ type: 'text', text: 'Toggle' }] },
              { type: 'toggleContent', content: [{ type: 'paragraph' }] },
            ],
          }),
      toggleToggleBlock:
        () =>
        ({ commands }) =>
          commands.setToggleBlock(),
      toggleToggleOpen:
        () =>
        ({ state, chain }) => {
          const $from = state.selection.$from;
          for (let depth = $from.depth; depth >= 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name === this.name) {
              return chain().updateAttributes(this.name, { open: !node.attrs.open }).run();
            }
          }
          return false;
        },
    };
  },

  addProseMirrorPlugins() {
    const name = this.name;
    return [
      new Plugin({
        key: new PluginKey('toggleBlockChevron'),
        props: {
          handleDOMEvents: {
            click(view, event) {
              const target = event.target as HTMLElement | null;
              if (!target?.classList?.contains('tiptap-toggle__chevron')) return false;
              const wrapper = target.closest('[data-toggle-block]') as HTMLElement | null;
              if (!wrapper) return false;
              const pos = view.posAtDOM(wrapper, 0);
              if (pos < 0) return false;
              const node = view.state.doc.nodeAt(pos);
              if (!node || node.type.name !== name) return false;
              event.preventDefault();
              event.stopPropagation();
              view.dispatch(
                view.state.tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  open: !node.attrs.open,
                }),
              );
              return true;
            },
          },
        },
      }),
    ];
  },
});

export const ToggleSummary = Node.create({
  name: 'toggleSummary',
  content: 'inline*',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-toggle-summary]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-toggle-summary': '',
        class: 'tiptap-toggle__summary',
      }),
      [
        'span',
        {
          contenteditable: 'false',
          class: 'tiptap-toggle__chevron',
          'aria-hidden': 'true',
        },
        '▸',
      ],
      ['span', { class: 'tiptap-toggle__summary-text' }, 0],
    ];
  },
});

export const ToggleContent = Node.create({
  name: 'toggleContent',
  content: 'block+',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-toggle-content]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-toggle-content': '',
        class: 'tiptap-toggle__content',
      }),
      0,
    ];
  },
});
