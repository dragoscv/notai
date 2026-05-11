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
        <h1 className="text-2xl font-semibold">Import & export</h1>
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

      <div className="bg-card space-y-3 rounded-2xl border p-6">
        <div>
          <h2 className="text-base font-medium">Export everything</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Download every note as newline-delimited JSON, with frontmatter (title, icon, folder,
            timestamps) and plaintext body. Re-importable into Notai or any tool that reads
            <code> {`{ path, content }`} </code> records.
          </p>
        </div>
        <a
          href="/api/v1/export"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
        >
          Download .ndjson
        </a>
      </div>
    </div>
  );
}
