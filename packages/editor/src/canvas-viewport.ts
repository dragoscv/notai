'use client';
import * as React from 'react';
import type * as Y from 'yjs';

/**
 * Shared canvas viewport geometry \u2014 the main editor publishes the size of
 * its note pane and current scroll offset to a Y.Map, and other views
 * (sticky notes in particular) read it back to reproduce an identical
 * layout at a scaled size.
 *
 * Keeping this in the Y.Doc rather than awareness means a late-joining
 * sticky can compute correct geometry on first paint instead of waiting
 * for the author to jiggle something.
 */
export interface CanvasViewport {
    /** Width of the drawing/text pane in CSS pixels at design time. */
    width: number;
    /** Height of the drawing/text pane in CSS pixels at design time. */
    height: number;
    /** Vertical scroll offset of the text column in CSS pixels. */
    scrollTop: number;
}

const VIEWPORT_MAP = 'viewport';

function readViewport(doc: Y.Doc): CanvasViewport | null {
    const map = doc.getMap(VIEWPORT_MAP);
    const width = map.get('width');
    const height = map.get('height');
    const scrollTop = map.get('scrollTop');
    if (
        typeof width !== 'number' ||
        typeof height !== 'number' ||
        typeof scrollTop !== 'number'
    ) {
        return null;
    }
    return { width, height, scrollTop };
}

/**
 * Publish the current editor pane geometry to the shared viewport map.
 * The writer is throttled with `requestAnimationFrame` so rapid scroll /
 * resize events collapse to at most one Yjs transaction per frame.
 */
export function useCanvasViewportWriter(
    doc: Y.Doc | null,
    pane: HTMLElement | null,
    scrollTop: number,
): void {
    const lastRef = React.useRef<CanvasViewport | null>(null);
    const rafRef = React.useRef(0);

    React.useEffect(() => {
        if (!doc || !pane) return;
        const map = doc.getMap(VIEWPORT_MAP);
        const schedule = () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                const next: CanvasViewport = {
                    width: pane.clientWidth,
                    height: pane.clientHeight,
                    scrollTop,
                };
                const prev = lastRef.current;
                if (
                    prev &&
                    prev.width === next.width &&
                    prev.height === next.height &&
                    prev.scrollTop === next.scrollTop
                ) {
                    return;
                }
                lastRef.current = next;
                doc.transact(() => {
                    map.set('width', next.width);
                    map.set('height', next.height);
                    map.set('scrollTop', next.scrollTop);
                }, 'local-viewport');
            });
        };
        schedule();

        const ro = new ResizeObserver(schedule);
        ro.observe(pane);
        return () => {
            ro.disconnect();
            cancelAnimationFrame(rafRef.current);
        };
    }, [doc, pane, scrollTop]);
}

/**
 * Subscribe to the shared viewport map. Returns `null` until the author
 * has published at least one geometry snapshot.
 */
export function useCanvasViewportReader(doc: Y.Doc | null): CanvasViewport | null {
    const [vp, setVp] = React.useState<CanvasViewport | null>(() =>
        doc ? readViewport(doc) : null,
    );

    React.useEffect(() => {
        if (!doc) return;
        setVp(readViewport(doc));
        const map = doc.getMap(VIEWPORT_MAP);
        const onChange = () => setVp(readViewport(doc));
        map.observe(onChange);
        return () => map.unobserve(onChange);
    }, [doc]);

    return vp;
}
