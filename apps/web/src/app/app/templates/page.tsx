import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { listTemplates } from '@/server/actions/templates';
import { TemplatesGalleryClient } from './gallery-client';

export const metadata = { title: 'Templates — Notai' };

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/templates');
  const tpls = await listTemplates();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Templates</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Start a note from a template. Designed for ADHD brains: tiny, forgiving structure that you
          can rewrite freely. Open any note and use the &ldquo;Save as template&rdquo; menu to add
          one of your own.
        </p>
      </header>

      <TemplatesGalleryClient templates={tpls} />

      <p className="text-muted-foreground pt-4 text-xs">
        <Link href="/app" className="underline">
          Back to your notes
        </Link>
      </p>
    </div>
  );
}
