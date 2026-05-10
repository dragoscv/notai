import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { MarkdownImportButton } from '@/components/settings/markdown-import-button';

export const metadata = { title: 'Import \u2014 Notai' };

export default async function ImportSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin?callbackUrl=/app/settings/import');
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Import notes</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Bring your notes in from Obsidian, Notion exports, or any markdown collection. Pick a
          folder \u2014 every <code>.md</code> file becomes a note. YAML frontmatter (
          <code>title</code>, <code>icon</code>,<code>emoji</code>) is honored.
        </p>
      </div>
      <div className="bg-card rounded-2xl border p-6">
        <MarkdownImportButton />
        <p className="text-muted-foreground mt-3 text-xs">
          Limits: 1 MiB per file, 200 files per batch (the importer chunks larger folders
          automatically). Files larger than 1 MiB are skipped.
        </p>
      </div>
    </div>
  );
}
