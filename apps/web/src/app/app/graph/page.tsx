import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getNoteGraph } from '@/server/actions/note-graph';
import { NoteGraphView } from '@/components/graph/note-graph-view';
import { SidebarToggle } from '@/components/layout/sidebar-toggle';

export const dynamic = 'force-dynamic';

export default async function GraphPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const [data, t] = await Promise.all([getNoteGraph(), getTranslations('pages.graph')]);
  const notesLabel =
    data.nodes.length === 1
      ? t('noteCountOne', { count: data.nodes.length })
      : t('noteCountOther', { count: data.nodes.length });
  const linksLabel =
    data.edges.length === 1
      ? t('linkCountOne', { count: data.edges.length })
      : t('linkCountOther', { count: data.edges.length });

  return (
    <div className="flex h-full flex-col">
      <header
        className="bg-background/70 flex shrink-0 items-center gap-2 border-b px-4 py-2 backdrop-blur"
        data-focus-hide
      >
        <SidebarToggle />
        <h1 className="text-sm font-medium">{t('title')}</h1>
        <p className="text-muted-foreground hidden text-xs sm:inline">
          {t('subtitle', { notes: notesLabel, links: linksLabel })}
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <NoteGraphView data={data} />
      </div>
    </div>
  );
}
