import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

interface OgCardOptions {
  /** Small uppercase label rendered above the title (e.g. "Features"). */
  eyebrow: string;
  /** Large hero title. */
  title: string;
  /** Optional subtitle line under the title. */
  subtitle?: string;
}

/**
 * Build a 1200x630 ImageResponse using the shared OLED-dark Notai
 * card layout. Used by per-route `opengraph-image.tsx` files so the
 * social cards stay visually consistent.
 */
export function ogCard({ eyebrow, title, subtitle }: OgCardOptions): ImageResponse {
  const node: ReactElement = (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(circle at 20% 30%, #1a1a3a 0%, #050510 40%, #000000 100%)',
        color: '#fafafa',
        padding: '80px 96px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #a78bfa 0%, #7e63d6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 700,
            color: '#0a0a14',
          }}
        >
          N
        </div>
        <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em' }}>Notai</div>
      </div>

      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#a78bfa',
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: '-0.035em',
            color: '#fafafa',
            maxWidth: 980,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontSize: 30,
              color: '#a1a1aa',
              maxWidth: 940,
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 48,
          display: 'flex',
          alignItems: 'center',
          color: '#a78bfa',
          fontSize: 22,
        }}
      >
        notai.ro
      </div>
    </div>
  );

  return new ImageResponse(node, OG_SIZE);
}
