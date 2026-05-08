import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { listTrash } from '@/server/actions/notes';
import { TrashList } from './trash-list';

export const dynamic = 'force-dynamic';

export default async function TrashPage() {
  const items = await listTrash();
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link href="/app" aria-label="Back">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl">Trash</h1>
            <p className="text-muted-foreground text-sm">
              Notes here are permanently deleted after 30 days.
            </p>
          </div>
        </div>
        <Trash2 className="text-muted-foreground size-5" />
      </header>
      <TrashList
        items={items.map((n) => ({
          id: n.id,
          title: n.title,
          icon: n.icon,
          deletedAt: n.deletedAt!.toISOString(),
          plaintext: n.plaintext.slice(0, 200),
        }))}
      />
    </div>
  );
}
