import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const runtime = 'edge';
export const alt = 'Notai — Changelog';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: 'Changelog',
    title: 'What we shipped.',
    subtitle: 'Every release, fix, and improvement — out in the open.',
  });
}
