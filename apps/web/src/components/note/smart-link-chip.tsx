'use client';

import * as React from 'react';

const URL_AT_START = /^https?:\/\/([^\s/?#]+)/i;

/**
 * If the note begins with a URL, render a tiny chip with the site's
 * favicon (via the public Google favicon service \u2014 no fetch from our
 * server, no SSRF risk) plus the hostname. Pure cosmetic; clicking
 * the chip opens the URL in a new tab.
 */
export function SmartLinkChip({ plaintext }: { plaintext: string | null | undefined }) {
  const match = React.useMemo(() => {
    if (!plaintext) return null;
    const m = plaintext.trim().match(URL_AT_START);
    if (!m) return null;
    const host = m[1] ?? '';
    if (!host || host.length > 80) return null;
    return { url: m[0], host };
  }, [plaintext]);

  if (!match) return null;
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(match.host)}&sz=32`;
  return (
    <a
      href={match.url}
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
      title={match.url}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={favicon} alt="" width={14} height={14} className="size-3.5" />
      <span className="max-w-[12rem] truncate">{match.host}</span>
    </a>
  );
}
