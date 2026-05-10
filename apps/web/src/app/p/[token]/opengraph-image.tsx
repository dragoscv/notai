import { ImageResponse } from 'next/og';
import { getPublicShare } from '@/server/actions/public-share';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

/**
 * Open Graph image for a publicly shared note. Pure CSS via @vercel/og's
 * `ImageResponse` — no asset assembly, no canvas. Falls back to a
 * generic Notai card if the share has been revoked.
 */
export default async function Image({ params }: { params: { token: string } }) {
  const note = await getPublicShare(params.token).catch(() => null);
  const title = note?.title || 'A note from Notai';
  const excerpt =
    (note?.plaintext || '').replace(/\s+/g, ' ').trim().slice(0, 220) ||
    'Shared with you via Notai — calm notes, sticky notes, and an infinite drawing canvas.';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #fbfaf5 0%, #efe7d6 60%, #d9c9a3 100%)',
        padding: '64px 72px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'serif',
        color: '#2b2417',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, opacity: 0.7 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: '#2b2417',
            color: '#fbfaf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
        >
          N
        </div>
        <span>Notai</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {note?.icon ? <span style={{ fontSize: 56, lineHeight: 1 }}>{note.icon}</span> : null}
        <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: 26, lineHeight: 1.4, opacity: 0.75, maxWidth: 980 }}>{excerpt}</div>
      </div>
      <div style={{ fontSize: 20, opacity: 0.6 }}>notai.ro</div>
    </div>,
    { ...size },
  );
}
