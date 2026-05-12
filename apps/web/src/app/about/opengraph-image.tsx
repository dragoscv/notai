import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const runtime = 'edge';
export const alt = 'About Notai';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: 'About',
    title: 'Built by one person who needed it.',
    subtitle: 'A calmer notebook for ADHD brains and quiet thinkers.',
  });
}
