'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { appendTextToScene, type CanvasNoteHandle } from '@notai/editor';
import { Popover, PopoverContent, PopoverTrigger } from '@notai/ui/components/popover';

interface Template {
  id: string;
  labelKey: string;
  descriptionKey: string;
  body: () => string;
}

const today = () => new Date().toISOString().slice(0, 10);

const TEMPLATES: Template[] = [
  {
    id: 'meeting',
    labelKey: 'meetingLabel',
    descriptionKey: 'meetingDesc',
    body: () => `# Meeting \u2014 ${today()}

Attendees:
- 

Agenda:
1. 
2. 
3. 

Discussion:
- 

Decisions:
- 

Action items:
- [ ] 
`,
  },
  {
    id: 'daily',
    labelKey: 'dailyLabel',
    descriptionKey: 'dailyDesc',
    body: () => `# ${today()}

Top 3 today:
1. 
2. 
3. 

Schedule:
- 09:00 
- 10:00 
- 11:00 

End of day:
- What got done?
- What\u2019s blocked?
- What\u2019s tomorrow\u2019s top priority?
`,
  },
  {
    id: 'decision',
    labelKey: 'decisionLabel',
    descriptionKey: 'decisionDesc',
    body: () => `# Decision \u2014 

Context:
- 

Options:
1. 
2. 
3. 

Criteria:
- 

Decision:
- 

Why:
- 

Revisit if:
- 
`,
  },
  {
    id: 'project',
    labelKey: 'projectLabel',
    descriptionKey: 'projectDesc',
    body: () => `# Project: 

Goal:
- 

In scope:
- 

Out of scope:
- 

Milestones:
- [ ] 
- [ ] 
- [ ] 

Owners:
- 

Risks:
- 
`,
  },
  {
    id: '1on1',
    labelKey: 'oneOnOneLabel',
    descriptionKey: 'oneOnOneDesc',
    body: () => `# 1:1 \u2014 ${today()}

Wins:
- 

Blockers:
- 

Growth focus:
- 

Asks for me:
- 

Asks for them:
- 
`,
  },
];

interface SceneApi {
  getSceneElements?(): readonly unknown[];
}

export function NoteTemplatesMenu({
  canvasRef,
}: {
  canvasRef: React.RefObject<CanvasNoteHandle | null>;
}) {
  const t = useTranslations('editor.templates.inline');
  const [open, setOpen] = React.useState(false);
  const insert = (tpl: Template) => {
    const api = canvasRef.current?.getExcalidrawApi() as SceneApi | null;
    if (!api) {
      toast.error(t('canvasNotReady'));
      return;
    }
    appendTextToScene(api as never, tpl.body(), { focus: true });
    toast.success(t('inserted', { name: t(tpl.labelKey) }));
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('trigger')}
          className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex size-8 items-center justify-center rounded-md"
          title={t('trigger')}
        >
          <LayoutTemplate className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        <div className="text-muted-foreground px-2 pb-1 pt-1 text-[10px] uppercase tracking-widest">
          {t('label')}
        </div>
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => insert(tpl)}
            className="hover:bg-accent flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left"
          >
            <span className="text-sm font-medium">{t(tpl.labelKey)}</span>
            <span className="text-muted-foreground text-xs">{t(tpl.descriptionKey)}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
