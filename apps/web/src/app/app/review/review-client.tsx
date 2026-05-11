'use client';

import * as React from 'react';
import { Button, Input, Textarea } from '@notai/ui';
import { toast } from 'sonner';
import { createFlashcard, deleteFlashcard, reviewFlashcard } from '@/server/actions/flashcards';

type DueCard = { id: string; front: string; back: string };
type AnyCard = DueCard & { dueAt: string; intervalDays: number };

const GRADES = [
  { q: 0, label: 'Again', hint: 'Forgot — show soon' },
  { q: 3, label: 'Hard', hint: 'Recalled with effort' },
  { q: 4, label: 'Good', hint: 'Recalled' },
  { q: 5, label: 'Easy', hint: 'Trivial' },
] as const;

export function ReviewClient({
  initialDue,
  allCards,
}: {
  initialDue: DueCard[];
  allCards: AnyCard[];
}) {
  const [queue, setQueue] = React.useState(initialDue);
  const [revealed, setRevealed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [tab, setTab] = React.useState<'review' | 'all' | 'new'>(
    initialDue.length > 0 ? 'review' : 'new',
  );
  const [front, setFront] = React.useState('');
  const [back, setBack] = React.useState('');

  const current = queue[0];

  const grade = async (q: number) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await reviewFlashcard({ id: current.id, quality: q });
      setQueue((qs) => qs.slice(1));
      setRevealed(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addCard = async () => {
    if (!front.trim() || !back.trim() || busy) return;
    setBusy(true);
    try {
      await createFlashcard({ front, back });
      toast.success('Card added');
      setFront('');
      setBack('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeCard = async (id: string) => {
    if (!confirm('Delete this card?')) return;
    try {
      await deleteFlashcard(id);
      toast.success('Deleted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b">
        {(['review', 'all', 'new'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize ${
              tab === t ? 'border-foreground border-b-2 font-medium' : 'text-muted-foreground'
            }`}
          >
            {t === 'review' ? `Review (${queue.length})` : t === 'all' ? 'All cards' : 'New card'}
          </button>
        ))}
      </div>

      {tab === 'review' && (
        <div>
          {current ? (
            <div className="bg-card rounded-lg border p-6 shadow-sm">
              <div className="whitespace-pre-wrap text-lg">{current.front}</div>
              {revealed ? (
                <>
                  <hr className="my-4" />
                  <div className="whitespace-pre-wrap text-base">{current.back}</div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {GRADES.map((g) => (
                      <Button
                        key={g.q}
                        variant={g.q === 0 ? 'destructive' : g.q === 5 ? 'default' : 'secondary'}
                        onClick={() => grade(g.q)}
                        disabled={busy}
                        title={g.hint}
                      >
                        {g.label}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-6">
                  <Button onClick={() => setRevealed(true)} disabled={busy}>
                    Show answer
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card text-muted-foreground rounded-lg border p-6 text-center">
              No cards due right now. Add some, or come back later.
            </div>
          )}
        </div>
      )}

      {tab === 'all' && (
        <div className="space-y-2">
          {allCards.length === 0 && (
            <div className="bg-card text-muted-foreground rounded-lg border p-6 text-center">
              No cards yet.
            </div>
          )}
          {allCards.map((c) => (
            <div key={c.id} className="bg-card rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.front}</div>
                  <div className="text-muted-foreground truncate text-xs">{c.back}</div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    Interval: {c.intervalDays}d · Due {new Date(c.dueAt).toLocaleDateString()}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeCard(c.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'new' && (
        <div className="bg-card space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Front</label>
            <Input
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Question or prompt"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Back</label>
            <Textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="Answer"
              rows={4}
            />
          </div>
          <Button onClick={addCard} disabled={busy || !front.trim() || !back.trim()}>
            Add card
          </Button>
        </div>
      )}
    </div>
  );
}
