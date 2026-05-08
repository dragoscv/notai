/**
 * MCP (Model Context Protocol) endpoint — Streamable HTTP transport.
 *
 * Spec: https://modelcontextprotocol.io  (revision 2025-06-18)
 *
 * Transport summary:
 *   - Single endpoint accepts JSON-RPC 2.0 messages via POST.
 *   - GET is reserved for the optional SSE channel (we return 405).
 *   - Responses are application/json (synchronous request/response).
 *   - Auth: Bearer access token issued by /api/oauth/token. The token
 *     must carry the `mcp` scope (or one of the per-tool fine-grained
 *     scopes) — enforced inside each tool handler.
 *
 * Tools exposed:
 *   - notes.list       (notes:read)
 *   - notes.search     (notes:read)
 *   - notes.get        (notes:read)
 *   - notes.create     (notes:write)
 *   - notes.update     (notes:write)
 *   - notes.archive    (notes:write or notes:delete)
 *   - folders.list     (folders:read or notes:read)
 *   - folders.create   (folders:write or notes:write)
 *   - me               (openid)
 */
import { z } from 'zod';
import { db, eq, users } from '@notai/db';
import { requireBearer } from '@/server/oauth-store';
import { getClientIp, rateLimit, tooManyRequestsResponse } from '@/lib/rate-limit';
import {
  apiArchiveNote,
  apiCreateFolder,
  apiCreateNote,
  apiGetNote,
  apiListFolders,
  apiListNotes,
  apiSearchNotes,
  apiUpdateNote,
} from '@/server/notes-api';

const SERVER_INFO = { name: 'notai', version: '0.1.0' };
const PROTOCOL_VERSION = '2025-06-18';

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredScope: string;
  /** Returns the MCP `content` array. */
  handler: (args: unknown, ctx: { userId: string }) => Promise<unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: 'notes.list',
    description:
      "List the user's notes (most recent first). Optional filters by folder/archived/favourite/pinned.",
    requiredScope: 'notes:read',
    inputSchema: {
      type: 'object',
      properties: {
        folderId: { type: ['string', 'null'], description: 'Folder id, or null for root' },
        archived: { type: 'boolean', default: false },
        favorite: { type: 'boolean' },
        pinned: { type: 'boolean' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
    },
    handler: async (args, { userId }) => {
      const a = z
        .object({
          folderId: z.string().nullable().optional(),
          archived: z.boolean().optional(),
          favorite: z.boolean().optional(),
          pinned: z.boolean().optional(),
          limit: z.number().int().min(1).max(200).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .parse(args ?? {});
      return apiListNotes(userId, a);
    },
  },
  {
    name: 'notes.search',
    description: 'Search notes by title and plaintext content (case-insensitive substring).',
    requiredScope: 'notes:read',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
    },
    handler: async (args, { userId }) => {
      const a = z
        .object({
          query: z.string().min(1),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .parse(args ?? {});
      return apiSearchNotes(userId, a.query, a.limit);
    },
  },
  {
    name: 'notes.get',
    description: 'Fetch the full plaintext + metadata of a single note by id.',
    requiredScope: 'notes:read',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    handler: async (args, { userId }) => {
      const a = z.object({ id: z.string().min(1) }).parse(args ?? {});
      const note = await apiGetNote(userId, a.id);
      if (!note) throw mcpError(-32004, 'Note not found.');
      return note;
    },
  },
  {
    name: 'notes.create',
    description: 'Create a new note. Returns the created row.',
    requiredScope: 'notes:write',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: 200 },
        icon: { type: ['string', 'null'] },
        kind: { type: 'string', enum: ['note', 'sticky'], default: 'note' },
        folderId: { type: ['string', 'null'] },
        plaintext: { type: 'string', description: 'Initial plaintext body' },
      },
    },
    handler: async (args, { userId }) => {
      const a = z
        .object({
          title: z.string().max(200).optional(),
          icon: z.string().nullable().optional(),
          kind: z.enum(['note', 'sticky']).optional(),
          folderId: z.string().nullable().optional(),
          plaintext: z.string().optional(),
        })
        .parse(args ?? {});
      const note = await apiCreateNote(userId, a);
      if (!note) throw mcpError(-32603, 'Could not create note.');
      return note;
    },
  },
  {
    name: 'notes.update',
    description:
      'Update a note. Only the owner may update via the API. Pass only the fields you want to change.',
    requiredScope: 'notes:write',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string', maxLength: 200 },
        icon: { type: ['string', 'null'] },
        color: { type: 'string' },
        plaintext: { type: 'string' },
        folderId: { type: ['string', 'null'] },
        isPinned: { type: 'boolean' },
        isFavorite: { type: 'boolean' },
        isArchived: { type: 'boolean' },
      },
    },
    handler: async (args, { userId }) => {
      const a = z
        .object({
          id: z.string().min(1),
          title: z.string().max(200).optional(),
          icon: z.string().nullable().optional(),
          color: z.string().max(30).optional(),
          plaintext: z.string().optional(),
          folderId: z.string().nullable().optional(),
          isPinned: z.boolean().optional(),
          isFavorite: z.boolean().optional(),
          isArchived: z.boolean().optional(),
        })
        .parse(args ?? {});
      const note = await apiUpdateNote(userId, a);
      if (!note) throw mcpError(-32004, 'Note not found or not owned by user.');
      return note;
    },
  },
  {
    name: 'notes.archive',
    description: 'Move a note to the archive (soft delete).',
    requiredScope: 'notes:write',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    handler: async (args, { userId }) => {
      const a = z.object({ id: z.string().min(1) }).parse(args ?? {});
      const r = await apiArchiveNote(userId, a.id);
      if (!r) throw mcpError(-32004, 'Note not found.');
      return { archived: true, id: r.id };
    },
  },
  {
    name: 'folders.list',
    description: 'List all folders for the user.',
    requiredScope: 'folders:read',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_a, { userId }) => apiListFolders(userId),
  },
  {
    name: 'folders.create',
    description: 'Create a new folder. Optional parentId for nested folders.',
    requiredScope: 'folders:write',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', maxLength: 200 },
        parentId: { type: ['string', 'null'] },
      },
    },
    handler: async (args, { userId }) => {
      const a = z
        .object({
          name: z.string().min(1).max(200),
          parentId: z.string().nullable().optional(),
        })
        .parse(args ?? {});
      const f = await apiCreateFolder(userId, a.name, a.parentId);
      if (!f) throw mcpError(-32603, 'Could not create folder.');
      return f;
    },
  },
  {
    name: 'me',
    description: 'Identity of the user this access token represents.',
    requiredScope: 'openid',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_a, { userId }) => {
      const [u] = await db
        .select({ id: users.id, name: users.name, email: users.email, image: users.image })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return u ?? null;
    },
  },
];

const TOOL_INDEX = new Map(TOOLS.map((t) => [t.name, t]));

// ─── Transport ───────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // SSE stream not implemented (MCP allows servers to omit it).
  // Still respond with 405 + the bearer challenge so clients learn
  // about the resource metadata.
  return mcpUnsupported(req);
}

export async function DELETE() {
  // No-op: clients calling DELETE expect us to clear server-side
  // state for their session. We're stateless; just acknowledge.
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  const ctype = req.headers.get('content-type') ?? '';
  if (!ctype.includes('application/json')) {
    return jsonRpcError(-32700, 'Content-Type must be application/json.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(-32700, 'Parse error: invalid JSON.');
  }

  // Notifications (no `id`) and single requests both supported.
  // Batches are not required by the 2025-06-18 spec — single-message only here.
  if (!isObject(body)) return jsonRpcError(-32600, 'Invalid request.');
  const { jsonrpc, method, id, params } = body as {
    jsonrpc?: string;
    method?: string;
    id?: string | number | null;
    params?: unknown;
  };

  if (jsonrpc !== '2.0' || typeof method !== 'string') {
    return jsonRpcError(-32600, 'Invalid request.', id);
  }

  // ── Methods that don't require auth ──
  if (method === 'initialize') {
    return jsonRpcOk(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
    });
  }
  if (method === 'ping') {
    return jsonRpcOk(id, {});
  }
  if (method === 'notifications/initialized') {
    return new Response(null, { status: 202 });
  }

  // Everything else needs a bearer token.
  const auth = await requireBearer(req);
  if (!auth.ok) return auth.response;

  // Rate limit per token (effectively per user/agent). 120 calls / 60s
  // is generous for tool-calling LLMs but stops a runaway loop or
  // compromised token from hammering the DB.
  const rl = await rateLimit({
    name: 'mcp',
    key: auth.token.id || getClientIp(req),
    windowSec: 60,
    max: 120,
  });
  if (!rl.ok) return tooManyRequestsResponse(rl);

  switch (method) {
    case 'tools/list': {
      return jsonRpcOk(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
    }
    case 'tools/call': {
      const p = params as { name?: string; arguments?: unknown } | undefined;
      const tool = p?.name ? TOOL_INDEX.get(p.name) : undefined;
      if (!tool) return jsonRpcError(-32601, `Unknown tool: ${p?.name ?? 'undefined'}`, id);

      const scopes = new Set(auth.token.scopes.split(/\s+/).filter(Boolean));
      if (!scopes.has(tool.requiredScope) && !scopes.has('mcp')) {
        return jsonRpcOk(id, {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Insufficient scope. Tool "${tool.name}" requires "${tool.requiredScope}" or "mcp".`,
            },
          ],
        });
      }

      try {
        const result = await tool.handler(p?.arguments, { userId: auth.userId });
        return jsonRpcOk(id, {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
          structuredContent: result,
        });
      } catch (err) {
        const code = (err as McpError).mcpCode ?? -32603;
        const isMcp = (err as McpError).mcpCode != null;
        // Only return raw error text for explicit mcpError() throws.
        // Anything else is an unexpected internal failure: log it server
        // side and return a generic message so we don't leak stack traces
        // or DB shape to a third-party MCP client.
        if (!isMcp) {
          console.error('[mcp] tool execution failed', err);
        }
        const message = isMcp ? (err as Error).message : 'Tool execution failed.';
        return jsonRpcOk(id, {
          isError: true,
          content: [{ type: 'text', text: message }],
          _meta: { code },
        });
      }
    }
    case 'resources/list':
      return jsonRpcOk(id, { resources: [] });
    case 'prompts/list':
      return jsonRpcOk(id, { prompts: [] });
    default:
      return jsonRpcError(-32601, `Method not found: ${method}`, id);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

interface McpError extends Error {
  mcpCode?: number;
}
function mcpError(code: number, message: string): McpError {
  const e = new Error(message) as McpError;
  e.mcpCode = code;
  return e;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function jsonRpcOk(id: unknown, result: unknown) {
  return Response.json(
    { jsonrpc: '2.0', id: id ?? null, result },
    { headers: { 'cache-control': 'no-store' } },
  );
}

function jsonRpcError(code: number, message: string, id: unknown = null) {
  return Response.json(
    { jsonrpc: '2.0', id, error: { code, message } },
    {
      status: code === -32700 || code === -32600 ? 400 : 200,
      headers: { 'cache-control': 'no-store' },
    },
  );
}

function mcpUnsupported(req: Request) {
  const url = new URL(req.url);
  const meta = `${url.protocol}//${url.host}/.well-known/oauth-protected-resource`;
  return new Response(
    JSON.stringify({ error: 'method_not_allowed', error_description: 'Use POST.' }),
    {
      status: 405,
      headers: {
        'content-type': 'application/json',
        allow: 'POST, DELETE',
        'www-authenticate': `Bearer realm="notai", resource_metadata="${meta}"`,
      },
    },
  );
}
