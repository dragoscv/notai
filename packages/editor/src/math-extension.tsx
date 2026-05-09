'use client';
import * as React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from '@tiptap/react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathInline: { setMathInline: (tex: string) => ReturnType };
    mathBlock: { setMathBlock: (tex: string) => ReturnType };
  }
}

let katexLoader: Promise<typeof import('katex')> | null = null;
let katexCssInjected = false;

function loadKatex(): Promise<typeof import('katex')> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('katex requires a browser'));
  }
  if (!katexCssInjected) {
    const id = 'katex-css';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
    katexCssInjected = true;
  }
  if (!katexLoader) katexLoader = import('katex');
  return katexLoader;
}

function MathView({ node, updateAttributes, editor, deleteNode }: NodeViewProps) {
  const tex = (node.attrs.tex as string) ?? '';
  const isBlock = node.type.name === 'mathBlock';
  const [editing, setEditing] = React.useState(tex.length === 0);
  const [draft, setDraft] = React.useState(tex);
  const containerRef = React.useRef<HTMLSpanElement | null>(null);

  React.useEffect(() => {
    if (editing) return;
    if (!tex.trim()) return;
    let alive = true;
    loadKatex()
      .then(({ default: katex }) => {
        if (!alive || !containerRef.current) return;
        try {
          katex.render(tex, containerRef.current, {
            displayMode: isBlock,
            throwOnError: false,
            output: 'htmlAndMathml',
          });
        } catch (err) {
          if (containerRef.current) {
            containerRef.current.textContent = `Math error: ${(err as Error).message}`;
          }
        }
      })
      .catch(() => {
        if (containerRef.current) containerRef.current.textContent = tex;
      });
    return () => {
      alive = false;
    };
  }, [tex, editing, isBlock]);

  const commit = React.useCallback(() => {
    if (!draft.trim()) {
      deleteNode();
      return;
    }
    updateAttributes({ tex: draft });
    setEditing(false);
  }, [draft, deleteNode, updateAttributes]);

  if (editing) {
    return (
      <NodeViewWrapper
        as={isBlock ? 'div' : 'span'}
        className={
          isBlock
            ? 'tiptap-math tiptap-math--block tiptap-math--editing'
            : 'tiptap-math tiptap-math--inline tiptap-math--editing'
        }
      >
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(tex);
              setEditing(false);
              if (!tex.trim()) deleteNode();
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            } else if (e.key === 'Enter' && !isBlock) {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          rows={isBlock ? 3 : 1}
          placeholder={isBlock ? '\\sum_{i=0}^n i^2' : 'e^{i\\pi}'}
          className="tiptap-math__input"
          spellCheck={false}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as={isBlock ? 'div' : 'span'}
      className={isBlock ? 'tiptap-math tiptap-math--block' : 'tiptap-math tiptap-math--inline'}
      onClick={() => {
        if (!editor.isEditable) return;
        setDraft(tex);
        setEditing(true);
      }}
      data-tex={tex}
    >
      <span ref={containerRef} className="tiptap-math__output" />
    </NodeViewWrapper>
  );
}

const sharedAttrs = {
  tex: {
    default: '',
    parseHTML: (el: HTMLElement) => el.getAttribute('data-tex') ?? el.textContent ?? '',
    renderHTML: (attrs: { tex: string }) => ({ 'data-tex': attrs.tex }),
  },
};

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return sharedAttrs;
  },
  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-math-inline': '',
        class: 'tiptap-math tiptap-math--inline',
      }),
      node.attrs.tex as string,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },
  addCommands() {
    return {
      setMathInline:
        (tex: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { tex } }),
    };
  },
});

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return sharedAttrs;
  },
  parseHTML() {
    return [{ tag: 'div[data-math-block]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-math-block': '',
        class: 'tiptap-math tiptap-math--block',
      }),
      node.attrs.tex as string,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },
  addCommands() {
    return {
      setMathBlock:
        (tex: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { tex } }),
    };
  },
});

// Re-export an unused symbol so consumers can keep the NodeViewContent
// import alive even when the build prunes it. Currently unused here but
// kept for future extensibility (e.g., editable inner LaTeX).
export const __MathNodeViewContent = NodeViewContent;
