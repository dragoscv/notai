import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const runtime = 'edge';
export const alt = 'Notai — Features';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: 'Features',
    title: 'Capture, find, and finish.',
    subtitle: 'Sticky windows, drawings, AI search, and offline-first sync.',
  });
}
