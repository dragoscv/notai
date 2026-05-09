'use client';
import * as React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: { setMermaid: (source: string) => ReturnType };
  }
}

type MermaidApi = (typeof import('mermaid'))['default'];
let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('mermaid requires a browser'));
  }
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const api = mod.default;
      const dark =
        document.documentElement.classList.contains('dark') ||
        window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      api.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: dark ? 'dark' : 'neutral',
        fontFamily: 'inherit',
      });
      return api;
    });
  }
  return mermaidPromise;
}

const PLACEHOLDER = `graph TD
  A[Idea] --> B[Notai]
  B --> C{Ship it}
  C -->|yes| D[Ship]
  C -->|no| A`;

function MermaidView({ node, updateAttributes, editor, deleteNode }: NodeViewProps) {
  const source = (node.attrs.source as string) ?? '';
  const [editing, setEditing] = React.useState(source.length === 0);
  const [draft, setDraft] = React.useState(source || PLACEHOLDER);
  const [error, setError] = React.useState<string | null>(null);
  const renderTarget = React.useRef<HTMLDivElement | null>(null);
  const idRef = React.useRef(`mmd-${Math.random().toString(36).slice(2)}`);

  React.useEffect(() => {
    if (editing || !source.trim()) return;
    let alive = true;
    setError(null);
    loadMermaid()
      .then((m) => m.parse(source).then(() => m.render(idRef.current, source)))
      .then(({ svg }) => {
        if (!alive || !renderTarget.current) return;
        renderTarget.current.innerHTML = svg;
      })
      .catch((err: Error) => {
        if (!alive) return;
        setError(err.message ?? String(err));
      });
    return () => {
      alive = false;
    };
  }, [source, editing]);

  const commit = React.useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) {
      deleteNode();
      return;
    }
    updateAttributes({ source: trimmed });
    setEditing(false);
  }, [draft, deleteNode, updateAttributes]);

  if (editing) {
    return (
      <NodeViewWrapper className="tiptap-mermaid tiptap-mermaid--editing">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              if (!source.trim()) deleteNode();
              else {
                setDraft(source);
                setEditing(false);
              }
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          spellCheck={false}
          rows={Math.min(12, Math.max(4, draft.split('\n').length + 1))}
          className="tiptap-mermaid__input"
          placeholder="graph TD ..."
        />
        <div className="tiptap-mermaid__hint">
          Press <kbd>Esc</kbd> to cancel, <kbd>⌘/Ctrl + Enter</kbd> to render.
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className="tiptap-mermaid"
      onDoubleClick={() => {
        if (!editor.isEditable) return;
        setDraft(source);
        setEditing(true);
      }}
      data-source={source}
    >
      {error ? (
        <div className="tiptap-mermaid__error">
          <strong>Mermaid error:</strong> {error}
          <pre>{source}</pre>
        </div>
      ) : (
        <div ref={renderTarget} className="tiptap-mermaid__svg" />
      )}
    </NodeViewWrapper>
  );
}

export const Mermaid = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      source: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-source') ?? el.textContent ?? '',
        renderHTML: (attrs: { source: string }) => ({ 'data-source': attrs.source }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-mermaid]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-mermaid': '', class: 'tiptap-mermaid' }),
      node.attrs.source as string,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidView);
  },

  addCommands() {
    return {
      setMermaid:
        (source: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { source } }),
    };
  },
});
