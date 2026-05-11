'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileText, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { applyTemplate, listTemplates, type TemplateSummary } from '@/server/actions/templates';

/**
 * Small dropdown trigger that opens a popover gallery of templates. Picking
 * one calls `applyTemplate` which inserts the template's body into a fresh
 * note and redirects there. Lives next to the sidebar's "+ new note" button
 * so the gallery is one click away without burying it in the templates page.
 */
export function NewFromTemplateButton({ folderId }: { folderId?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<TemplateSummary[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (templates) return;
    listTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open, templates]);

  const pick = async (slug: string) => {
    setBusy(slug);
    try {
      // applyTemplate redirects on success — wrap so we can still toast on failure.
      await applyTemplate({ slug });
      // Should be unreachable (redirect throws NEXT_REDIRECT) but keep nav as a fallback.
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('NEXT_REDIRECT')) {
        toast.error(msg || 'Could not apply template');
      }
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };
  // folderId reserved for a future "create in this folder" path; the server
  // action already chooses a sensible home for the new note.
  void folderId;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="New from template"
        aria-label="New from template"
        className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md"
      >
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10"
            aria-label="Close template picker"
          />
          <div className="bg-popover absolute right-0 z-20 mt-1 max-h-[60vh] w-72 overflow-y-auto rounded-lg border text-sm shadow-md">
            <div className="text-muted-foreground border-b px-3 py-2 text-[11px] uppercase tracking-wider">
              Start from template
            </div>
            {templates == null ? (
              <div className="text-muted-foreground flex items-center gap-2 px-3 py-3 text-xs">
                <Loader2 className="size-3 animate-spin" /> Loading…
              </div>
            ) : templates.length === 0 ? (
              <div className="text-muted-foreground px-3 py-3 text-xs">
                No templates yet. Visit{' '}
                <a className="underline" href="/app/templates">
                  /app/templates
                </a>{' '}
                to add one.
              </div>
            ) : (
              <ul>
                {templates.map((t) => {
                  const isBusy = busy === t.slug;
                  return (
                    <li key={t.slug}>
                      <button
                        type="button"
                        disabled={isBusy || busy != null}
                        onClick={() => void pick(t.slug)}
                        className="hover:bg-muted flex w-full items-start gap-3 px-3 py-2 text-left disabled:opacity-60"
                      >
                        <span className="mt-0.5 text-base" aria-hidden>
                          {t.icon ?? '📄'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{t.title}</span>
                          {t.description && (
                            <span className="text-muted-foreground block truncate text-xs">
                              {t.description}
                            </span>
                          )}
                        </span>
                        {isBusy ? (
                          <Loader2 className="mt-1 size-3.5 animate-spin" />
                        ) : t.isOfficial ? (
                          <Sparkles className="mt-1 size-3.5 text-amber-500" />
                        ) : (
                          <FileText className="text-muted-foreground mt-1 size-3.5" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <a
              href="/app/templates"
              className="text-muted-foreground hover:bg-muted block border-t px-3 py-2 text-xs"
            >
              Manage templates →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
