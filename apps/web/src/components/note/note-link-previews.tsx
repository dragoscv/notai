import { useTranslations } from 'next-intl';
import { LinkPreviewCard } from './link-preview-card';

const URL_RE = /\bhttps?:\/\/[^\s)<>"']+/gi;
const MAX_PREVIEWS = 6;

/**
 * Scans the note's plaintext mirror for HTTP(S) URLs and renders an
 * inline preview card per unique link (capped to MAX_PREVIEWS to avoid
 * spamming notes with hundreds of references). Server-only string
 * processing; the cards themselves fetch metadata client-side via the
 * cached `/api/link-preview` endpoint.
 */
export function NoteLinkPreviews({ plaintext }: { plaintext: string | null | undefined }) {
  const t = useTranslations('editor.links.preview');
  if (!plaintext) return null;
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of plaintext.matchAll(URL_RE)) {
    const u = match[0].replace(/[.,;:!?)]+$/, '');
    if (seen.has(u)) continue;
    seen.add(u);
    urls.push(u);
    if (urls.length >= MAX_PREVIEWS) break;
  }
  if (urls.length === 0) return null;
  return (
    <section className="mt-4 space-y-2">
      <h3 className="text-muted-foreground text-xs font-medium">{t('heading')}</h3>
      {urls.map((u) => (
        <LinkPreviewCard key={u} url={u} />
      ))}
    </section>
  );
}
