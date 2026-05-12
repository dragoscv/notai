'use client';

import * as React from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { importMarkdown, type ImportResult } from '@/server/actions/import-markdown';

const MAX_FILE_BYTES = 1_048_576;
const MAX_FILES_PER_BATCH = 200;

/**
 * Drop a folder of `.md` files (Obsidian vault, Notion HTML+MD export
 * once unzipped, etc.). Files are batched and uploaded to the import
 * server action; `webkitdirectory` lets the user pick a whole folder.
 */
export function MarkdownImportButton() {
  const t = useTranslations('settings.markdownImport');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setBusy(true);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    try {
      const accepted = files.filter((f) => /\.(md|markdown|txt)$/i.test(f.name));
      for (let i = 0; i < accepted.length; i += MAX_FILES_PER_BATCH) {
        const batch = accepted.slice(i, i + MAX_FILES_PER_BATCH);
        const payload: { path: string; content: string }[] = [];
        for (const f of batch) {
          if (f.size > MAX_FILE_BYTES) {
            skipped += 1;
            continue;
          }
          payload.push({ path: f.webkitRelativePath || f.name, content: await f.text() });
        }
        if (payload.length === 0) continue;
        const res: ImportResult = await importMarkdown({ files: payload });
        imported += res.imported;
        skipped += res.skipped;
        errors.push(...res.errors);
      }
      toast.success(imported === 1 ? t('importedOne') : t('importedOther', { count: imported }), {
        description:
          skipped > 0 || errors.length > 0
            ? t('summary', { skipped, errors: errors.length })
            : undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('failed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        multiple
        // @ts-expect-error - non-standard but supported by all major browsers
        webkitdirectory=""
        directory=""
        onChange={onPick}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {t('button')}
      </Button>
    </>
  );
}
