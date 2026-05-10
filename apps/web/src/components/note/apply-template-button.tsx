'use client';
import * as React from 'react';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@notai/ui';
import { listTemplates, type TemplateSummary } from '@/server/actions/templates';
import { applyTemplateToNote } from '@/server/actions/apply-template';

/**
 * Apply-a-template button. Opens a dialog with the public template
 * gallery and lets the user drop the template's structure onto the
 * current canvas in one of two ways:
 *   • "Use as-is"      — inserts the raw skeleton, the user fills it in.
 *   • "Fill with AI"   — sends the user's existing note content to the
 *                        AI which maps existing material into the
 *                        template's sections; placeholders stay empty
 *                        when there's no evidence to fill them.
 */
export function ApplyTemplateButton({
  noteId,
  onInsert,
}: {
  noteId: string;
  onInsert: (markdown: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [list, setList] = React.useState<TemplateSummary[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || list != null) return;
    let cancelled = false;
    listTemplates()
      .then((items) => {
        if (!cancelled) setList(items);
      })
      .catch((err) => {
        if (!cancelled) toast.error((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [open, list]);

  const apply = async (slug: string, mode: 'blank' | 'ai-fill') => {
    setBusy(`${slug}:${mode}`);
    const t = toast.loading(mode === 'ai-fill' ? 'Filling template…' : 'Applying…');
    try {
      const res = await applyTemplateToNote({ noteId, slug, mode });
      onInsert(res.markdown);
      toast.success(`${res.templateTitle} applied`, { id: t });
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message, { id: t });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
        title="Apply a template to this note"
      >
        <FileText className="size-3.5" />
        Template
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4" /> Apply a template
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground -mt-2 text-xs">
            Drop a structured skeleton onto this canvas. &ldquo;Fill with AI&rdquo; uses your
            existing note content to populate the sections — placeholders stay empty when there is
            nothing to map.
          </p>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {list == null && (
              <div className="text-muted-foreground inline-flex items-center gap-2 px-2 py-6 text-sm">
                <Loader2 className="size-4 animate-spin" /> Loading templates…
              </div>
            )}
            {list?.length === 0 && (
              <div className="text-muted-foreground px-2 py-6 text-sm">
                No templates published yet.
              </div>
            )}
            {list?.map((tpl) => {
              const blankBusy = busy === `${tpl.slug}:blank`;
              const aiBusy = busy === `${tpl.slug}:ai-fill`;
              const anyBusy = busy != null;
              return (
                <div key={tpl.id} className="bg-card flex items-start gap-3 rounded-lg border p-3">
                  <div className="text-2xl leading-none">{tpl.icon || '📄'}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">{tpl.title}</h3>
                      <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        {tpl.category}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                      {tpl.description}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={anyBusy}
                        onClick={() => apply(tpl.slug, 'blank')}
                        className="hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs disabled:opacity-60"
                      >
                        {blankBusy ? <Loader2 className="size-3 animate-spin" /> : null}
                        Use as-is
                      </button>
                      <button
                        type="button"
                        disabled={anyBusy}
                        onClick={() => apply(tpl.slug, 'ai-fill')}
                        className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-2.5 py-1 text-xs text-white disabled:opacity-60"
                      >
                        {aiBusy ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                        Fill with AI
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
