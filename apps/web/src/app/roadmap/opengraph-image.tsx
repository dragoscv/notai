import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const runtime = 'edge';
export const alt = 'Notai — Roadmap';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: 'Roadmap',
    title: 'Small plan, kept honest.',
    subtitle: 'What\u2019s shipped, in flight, and next.',
  });
}
