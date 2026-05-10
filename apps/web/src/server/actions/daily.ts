'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import * as Y from 'yjs';
import { auth } from '@/auth';
import { db, notes, users, eq, and, isNull } from '@notai/db';
import { requireQuota } from '@/server/plans';
import { localDateKey, dailyNoteTitle } from '@/server/daily-utils';

/**
 * Returns today's "Daily — YYYY-MM-DD" note for the current user, creating
 * it on first call. The title is the canonical lookup key (cheap and
 * human-readable) and we tag the note with the 📅 icon.
 *
 * "Today" is computed in the user's IANA timezone (synced from the
 * browser via `<TimezoneSync>` and stored in `users.timezone`). UTC
 * is used as a safe fallback when no timezone has been recorded yet.
 */
export async function getOrCreateDailyNote(): Promise<{ id: string; title: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const userId = session.user.id;

  const [me] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const title = dailyNoteTitle(localDateKey(me?.timezone ?? null));

  const [existing] = await db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), eq(notes.title, title), isNull(notes.deletedAt)))
    .limit(1);
  if (existing) return existing;

  await requireQuota(userId, 'notes');
  const [row] = await db
    .insert(notes)
    .values({
      ownerId: userId,
      title,
      icon: '📅',
      kind: 'note',
      plaintext: dailyNoteTemplate(title),
    })
    .returning({ id: notes.id, title: notes.title });

  if (!row) throw new Error('Failed to create daily note');
  revalidatePath('/app');
  return row;
}

/**
 * Default body for a fresh daily note. Sectioned to gently structure
 * the day without forcing the user into rigid blocks. Tasks use the
 * `[ ]` syntax so they flow into the dashboard's Today rollup.
 */
function dailyNoteTemplate(title: string): string {
  return [
    `# ${title}`,
    '',
    '## 🎯 Top three',
    '- [ ] ',
    '- [ ] ',
    '- [ ] ',
    '',
    '## 📓 Notes',
    '',
    '',
    '## 🌙 End of day',
    '- What went well: ',
    '- One thing to improve: ',
    '',
  ].join('\n');
}

/** Server-action wrapper that redirects straight into today's daily note. */
export async function openDailyNote(): Promise<never> {
  const note = await getOrCreateDailyNote();
  redirect(`/app/n/${note.id}`);
}

/**
 * Returns the open (unchecked) task-list items from yesterday's daily
 * note, so the UI can offer a one-click "Roll forward" into today.
 *
 * "Yesterday" is derived in the user's IANA timezone — same convention
 * as `getOrCreateDailyNote`. We look up yesterday's note by canonical
 * title and walk its Y.Doc for `taskItem` nodes whose `checked` attr
 * is false.
 */
export async function getYesterdayOpenTodos(): Promise<{
  date: string;
  items: string[];
}> {
  const session = await auth();
  if (!session?.user?.id) return { date: '', items: [] };
  const userId = session.user.id;

  const [me] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const date = localDateKey(me?.timezone ?? null, yesterday);
  const title = dailyNoteTitle(date);

  const [row] = await db
    .select({ yjsState: notes.yjsState })
    .from(notes)
    .where(and(eq(notes.ownerId, userId), eq(notes.title, title), isNull(notes.deletedAt)))
    .limit(1);

  if (!row?.yjsState) return { date, items: [] };

  try {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, row.yjsState as Uint8Array);
    return { date, items: extractOpenTodos(doc) };
  } catch {
    return { date, items: [] };
  }
}

/** Walk every block fragment + legacy fragments for unchecked taskItems. */
function extractOpenTodos(doc: Y.Doc): string[] {
  const items: string[] = [];
  const seen = new Set<string>();

  const collect = (frag: Y.XmlFragment) => {
    walkForTodos(frag, items, seen);
  };

  // Canvas-first scene model: walk each block's content fragment.
  const scene = doc.getMap('scene');
  const blocks = scene.get('blocks') as Y.Array<{ id: string }> | undefined;
  if (blocks && typeof blocks.toArray === 'function') {
    const contentMap = doc.getMap('blocks-content');
    for (const block of blocks.toArray()) {
      if (block.id === '__legacy__') {
        for (const key of ['default', 'prosemirror'] as const) {
          collect(doc.getXmlFragment(key));
        }
        continue;
      }
      const frag = contentMap.get(block.id) as Y.XmlFragment | undefined;
      if (frag) collect(frag);
    }
  } else {
    // Unmigrated legacy doc.
    for (const key of ['default', 'prosemirror'] as const) {
      collect(doc.getXmlFragment(key));
    }
  }

  // Excalidraw scene: scan every text element for `[ ]` / `[x]` markers
  // (with or without bullet/number prefixes). This is the canvas-first
  // home for tasks now that Phase-3 made TipTap blocks read-only — a
  // user creating tasks today writes them straight onto the scene as
  // `[ ] do thing` lines, so rollover must understand that shape too.
  try {
    const excalidraw = doc.getMap('excalidraw');
    const elements = excalidraw.get('elements') as
      | Array<{ type?: string; text?: string; isDeleted?: boolean }>
      | undefined;
    if (Array.isArray(elements)) {
      for (const el of elements) {
        if (!el || el.isDeleted) continue;
        if (el.type !== 'text') continue;
        const raw = typeof el.text === 'string' ? el.text : '';
        if (!raw) continue;
        for (const line of raw.split(/\r?\n/)) {
          const m = /^\s*(?:[-*•]|\d+[.)])?\s*\[(\s|x|X)\]\s*(.+?)\s*$/.exec(line);
          if (!m) continue;
          const checked = m[1] !== ' ';
          if (checked) continue;
          const text = (m[2] ?? '').trim();
          if (!text) continue;
          const norm = text.toLowerCase();
          if (seen.has(norm)) continue;
          seen.add(norm);
          items.push(text);
        }
      }
    }
  } catch {
    /* malformed scene — ignore, TipTap pass already collected what it could */
  }

  return items.slice(0, 50);
}

function walkForTodos(node: Y.XmlFragment | Y.XmlElement, out: string[], seen: Set<string>): void {
  const children =
    typeof (node as Y.XmlElement).toArray === 'function' ? (node as Y.XmlElement).toArray() : [];
  for (const child of children) {
    if (child instanceof Y.XmlElement) {
      if (child.nodeName === 'taskItem') {
        const checked = child.getAttribute('checked');
        // TipTap stores boolean attrs as strings in XML serialisation; both
        // false-string and missing attr count as "not done".
        if (checked !== 'true') {
          const text = elementText(child).trim();
          const norm = text.toLowerCase();
          if (text && !seen.has(norm)) {
            seen.add(norm);
            out.push(text);
          }
        }
        // Don't recurse into checked subtasks; nested unchecked siblings
        // still get picked up via this same traversal of the parent list.
        walkForTodos(child, out, seen);
      } else {
        walkForTodos(child, out, seen);
      }
    }
  }
}

function elementText(el: Y.XmlElement | Y.XmlFragment): string {
  const parts: string[] = [];
  const children = typeof el.toArray === 'function' ? el.toArray() : [];
  for (const child of children) {
    if (child instanceof Y.XmlText) {
      parts.push(child.toString());
    } else if (child instanceof Y.XmlElement) {
      parts.push(elementText(child));
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
