import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutVariant = 'info' | 'tip' | 'success' | 'warn' | 'danger';

const VARIANTS: CalloutVariant[] = ['info', 'tip', 'success', 'warn', 'danger'];
const DEFAULT_ICONS: Record<CalloutVariant, string> = {
  info: '💡',
  tip: '✨',
  success: '✅',
  warn: '⚠️',
  danger: '🚫',
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { variant?: CalloutVariant; icon?: string }) => ReturnType;
      toggleCallout: (attrs?: { variant?: CalloutVariant; icon?: string }) => ReturnType;
      unsetCallout: () => ReturnType;
      cycleCalloutVariant: () => ReturnType;
    };
  }
}

/**
 * Block container with a colored sidebar and emoji icon. Variants map to
 * Tailwind utility classes via `data-variant` so themes can override
 * without re-rendering the document.
 */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'info' as CalloutVariant,
        parseHTML: (el) => {
          const v = (el.getAttribute('data-variant') ?? 'info') as CalloutVariant;
          return VARIANTS.includes(v) ? v : 'info';
        },
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant }),
      },
      icon: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-icon'),
        renderHTML: (attrs) => (attrs.icon ? { 'data-icon': attrs.icon } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const variant = (node.attrs.variant as CalloutVariant) ?? 'info';
    const icon = (node.attrs.icon as string | null) ?? DEFAULT_ICONS[variant];
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'tiptap-callout' }),
      ['span', { class: 'tiptap-callout__icon', contenteditable: 'false' }, icon],
      ['div', { class: 'tiptap-callout__body' }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { variant: 'info', ...attrs }),
      toggleCallout:
        (attrs) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { variant: 'info', ...attrs }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
      cycleCalloutVariant:
        () =>
        ({ state, chain }) => {
          const $from = state.selection.$from;
          for (let depth = $from.depth; depth >= 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name === this.name) {
              const current = (node.attrs.variant as CalloutVariant) ?? 'info';
              const next = VARIANTS[(VARIANTS.indexOf(current) + 1) % VARIANTS.length];
              return chain().updateAttributes(this.name, { variant: next }).run();
            }
          }
          return false;
        },
    };
  },

  addInputRules() {
    // Markdown-ish: `> [!info] ` at the start of a paragraph turns into a callout.
    return [];
  },
});

export const CALLOUT_VARIANTS = VARIANTS;
export const CALLOUT_DEFAULT_ICONS = DEFAULT_ICONS;
