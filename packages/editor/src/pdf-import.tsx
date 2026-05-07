'use client';
import * as React from 'react';
import type {
    ExcalidrawImperativeAPI,
    BinaryFileData,
} from '@excalidraw/excalidraw/types';
import type {
    OrderedExcalidrawElement,
    ExcalidrawImageElement,
} from '@excalidraw/excalidraw/element/types';

/**
 * Rasterize a PDF file and insert each page as an image element onto the
 * Excalidraw canvas. Pages are stacked vertically with a small gap.
 *
 * Implementation notes:
 *   - Uses pdfjs-dist, loaded dynamically so it's not in the main bundle.
 *   - Each page is rendered to an offscreen canvas at 2x devicePixelRatio for
 *     crisp zoom, then converted to a PNG data URL.
 *   - `api.addFiles([...])` adds the image bytes to the scene's file cache;
 *     then each ExcalidrawImageElement references the file by id.
 *   - Reconstructing element IDs with `crypto.randomUUID()` keeps things
 *     simple and they're never "seen" by the caller \u2014 Excalidraw will
 *     normalize them internally.
 */
export async function importPdfToCanvas(
    api: ExcalidrawImperativeAPI,
    file: File,
    opts?: { maxPages?: number; scale?: number; gap?: number },
): Promise<{ pages: number }> {
    const maxPages = opts?.maxPages ?? 30;
    const scale = opts?.scale ?? 2;
    const gap = opts?.gap ?? 24;

    // Lazy-load pdfjs-dist (large). Its `main` field points to build/pdf.mjs
    // already, and the top-level package ships TypeScript types.
    const pdfjsLib = await import('pdfjs-dist');
    // Run on the main thread: avoids bundler-specific worker-URL resolution.
    // PDF import is a one-shot user action, not a steady stream, so the cost
    // of losing worker parallelism is acceptable.
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
        data: buf,
        // `disableWorker` is honored by pdfjs at runtime but isn't in the
        // exported types yet; cast the init object to keep TS happy.
        ...({ disableWorker: true } as object),
    }).promise;
    const total = Math.min(pdf.numPages, maxPages);

    const files: BinaryFileData[] = [];
    const elements: OrderedExcalidrawElement[] = [];

    let y = 0;
    for (let i = 1; i <= total; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not acquire 2D context for PDF page');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataURL = canvas.toDataURL('image/png');
        const fileId = crypto.randomUUID() as string & { _brand?: 'FileId' };

        files.push({
            id: fileId as unknown as BinaryFileData['id'],
            dataURL: dataURL as unknown as BinaryFileData['dataURL'],
            mimeType: 'image/png',
            created: Date.now(),
        });

        // Pages use the raw pixel size at scale=1 so the on-canvas size
        // matches the PDF's intrinsic units.
        const width = viewport.width / scale;
        const height = viewport.height / scale;

        elements.push(buildImageElement({
            id: crypto.randomUUID(),
            fileId: fileId as unknown as ExcalidrawImageElement['fileId'],
            x: 0,
            y,
            width,
            height,
        }));

        y += height + gap;
    }

    if (files.length) api.addFiles(files);
    const existing = api.getSceneElementsIncludingDeleted();
    api.updateScene({
        elements: [...existing, ...elements] as unknown as OrderedExcalidrawElement[],
    });
    api.scrollToContent(elements[0], { fitToContent: true, animate: false });

    return { pages: elements.length };
}

/**
 * Hook that returns an `importPdf` function plus a hidden <input type="file">
 * to trigger. Consumers just render `{pdfInput}` somewhere in their tree and
 * call `openPdfPicker()` to prompt the user.
 */
export function usePdfImport(api: ExcalidrawImperativeAPI | null) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [busy, setBusy] = React.useState(false);

    const openPdfPicker = React.useCallback(() => {
        inputRef.current?.click();
    }, []);

    const onChange = React.useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || !api) return;
            setBusy(true);
            try {
                await importPdfToCanvas(api, file);
            } finally {
                setBusy(false);
            }
        },
        [api],
    );

    const pdfInput = (
        <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={onChange}
        />
    );

    return { openPdfPicker, pdfInput, busy };
}

/* -------------------------------------------------------------------- */
/* Helpers                                                                */
/* -------------------------------------------------------------------- */

interface BuildImageOpts {
    id: string;
    fileId: ExcalidrawImageElement['fileId'];
    x: number;
    y: number;
    width: number;
    height: number;
}

function buildImageElement({
    id,
    fileId,
    x,
    y,
    width,
    height,
}: BuildImageOpts): OrderedExcalidrawElement {
    // Excalidraw normalizes missing props via its restore step, but we need the
    // minimum shape of an image element. Anything we leave off is filled in.
    return {
        id,
        type: 'image',
        x,
        y,
        width,
        height,
        angle: 0,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 2 ** 31),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2 ** 31),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        fileId,
        status: 'saved',
        scale: [1, 1],
        index: null,
        // Some versions of Excalidraw use `crop`; leave undefined.
    } as unknown as OrderedExcalidrawElement;
}
