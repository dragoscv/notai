'use client';

import * as React from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

interface Meta {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

const cache = new Map<string, Meta | 'error'>();

/**
 * Notion-style inline link preview card. Fetches OG metadata via our
 * `/api/link-preview` endpoint (CORS + SSRF-safe). We memoise responses
 * in module-level memory so repeated mounts of the same URL within a
 * session don't re-hit the network.
 */
export function LinkPreviewCard({ url }: { url: string }) {
  const [meta, setMeta] = React.useState<Meta | 'loading' | 'error'>(cache.get(url) ?? 'loading');

  React.useEffect(() => {
    if (cache.has(url)) {
      setMeta(cache.get(url)!);
      return;
    }
    let alive = true;
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Meta) => {
        if (!alive) return;
        cache.set(url, data);
        setMeta(data);
      })
      .catch(() => {
        if (!alive) return;
        cache.set(url, 'error');
        setMeta('error');
      });
    return () => {
      alive = false;
    };
  }, [url]);

  if (meta === 'loading') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-card text-muted-foreground my-2 flex items-center gap-2 rounded-lg border p-3 text-xs"
      >
        <Loader2 className="size-3.5 animate-spin" /> Loading preview\u2026
      </a>
    );
  }
  if (meta === 'error') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary my-1 inline-flex items-center gap-1 text-sm hover:underline"
      >
        {url} <ExternalLink className="size-3" />
      </a>
    );
  }
  return (
    <a
      href={meta.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-card hover:bg-accent my-2 flex overflow-hidden rounded-lg border transition"
    >
      <div className="min-w-0 flex-1 p-3">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          {meta.favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meta.favicon} alt="" className="size-3.5 rounded-sm" />
          )}
          <span className="truncate">{meta.siteName ?? new URL(meta.url).hostname}</span>
        </div>
        {meta.title && (
          <div className="text-foreground mt-1 line-clamp-1 text-sm font-medium">{meta.title}</div>
        )}
        {meta.description && (
          <div className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
            {meta.description}
          </div>
        )}
      </div>
      {meta.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.image}
          alt=""
          className="hidden size-24 shrink-0 object-cover sm:block"
          loading="lazy"
        />
      )}
    </a>
  );
}
