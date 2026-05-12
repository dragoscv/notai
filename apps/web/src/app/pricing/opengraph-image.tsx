import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const runtime = 'edge';
export const alt = 'Notai — Pricing';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: 'Pricing',
    title: 'Free forever. Pro when you need more.',
    subtitle: 'Local-first and self-hostable. Pay only for cloud sync, AI, and storage.',
  });
}
