import { ImageResponse } from 'next/og';

/**
 * Default Open Graph image used by every marketing page that does not
 * define its own `opengraph-image.tsx`. 1200×630 dark card with the
 * Notai wordmark and the homepage tagline. No external font fetch —
 * keeps build deterministic and offline-buildable.
 */
export const runtime = 'edge';
export const alt = 'Notai — your calm place to think';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
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
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 88,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: '-0.035em',
            color: '#fafafa',
            maxWidth: 920,
          }}
        >
          Your calm place to think.
        </div>
        <div
          style={{
            fontSize: 30,
            color: '#a1a1aa',
            maxWidth: 880,
            lineHeight: 1.3,
          }}
        >
          A local-first notebook with sticky windows, drawings, and optional cloud sync.
        </div>
      </div>

      <div
        style={{
          marginTop: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          color: '#a78bfa',
          fontSize: 22,
        }}
      >
        notai.ro
      </div>
    </div>,
    size,
  );
}
