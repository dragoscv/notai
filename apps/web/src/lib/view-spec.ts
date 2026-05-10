import { z } from 'zod';

/**
 * Shared spec for dashboard saved views. Lives in its own module so server
 * actions, client components, and the `listNotes` query can all import the
 * same Zod schema and inferred type without circular deps.
 */

export const sortKeys = ['updated', 'created', 'opened', 'alphabetical', 'custom'] as const;
export type SortKey = (typeof sortKeys)[number];

export const updatedWithinValues = ['any', 'today', '7d', '30d'] as const;
export type UpdatedWithin = (typeof updatedWithinValues)[number];

export const filterSchema = z.object({
  /** Folder ids to include. `null` means "no folder" (root). Empty = no filter. */
  folderIds: z.array(z.string().nullable()).default([]),
  tagIds: z.array(z.string()).default([]),
  kinds: z.array(z.enum(['note', 'sticky'])).default([]),
  status: z.array(z.enum(['pinned', 'favorite', 'archived', 'pinnedOnToday'])).default([]),
  colors: z.array(z.string()).default([]),
  hasCollaborators: z.boolean().optional(),
  updatedWithin: z.enum(updatedWithinValues).default('any'),
  search: z.string().max(200).default(''),
});

export type FilterSpec = z.infer<typeof filterSchema>;

const DEFAULT_FILTERS: FilterSpec = filterSchema.parse({});

export const viewSpecSchema = z.object({
  sort: z.enum(sortKeys).default('updated'),
  pinnedFirst: z.boolean().default(true),
  filters: filterSchema.default(() => DEFAULT_FILTERS),
});

export type ViewSpec = z.infer<typeof viewSpecSchema>;

export const DEFAULT_VIEW_SPEC: ViewSpec = viewSpecSchema.parse({});
