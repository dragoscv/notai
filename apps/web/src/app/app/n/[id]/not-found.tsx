import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@notai/ui/components/button';

export async function generateMetadata() {
  const t = await getTranslations('system.noteNotFound');
  return { title: t('metadataTitle') };
}

export default async function NoteNotFound() {
  const t = await getTranslations('system.noteNotFound');
  return (
    <div className="grid h-full w-full place-items-center px-6 py-12">
      <div className="max-w-md text-center">
        <div className="bg-muted text-muted-foreground mx-auto mb-5 grid size-12 place-items-center rounded-full">
          <FileQuestion className="size-6" />
        </div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t('body')}</p>
        <div className="mt-6">
          <Button asChild size="sm">
            <Link href="/app">
              <ArrowLeft className="size-3.5" /> {t('backToNotes')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
