/**
 * OpenAPI 3.1 spec for the public Notai REST API.
 *
 * Hand-maintained alongside the route handlers in
 * `apps/web/src/app/api/v1/**`. When you add or change a v1 route,
 * update this spec — it is what powers /developers/api/reference and
 * the JSON document at /api/v1/openapi.
 */
export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: Array<{ url: string; description?: string }>;
  components: Record<string, unknown>;
  security: Array<Record<string, string[]>>;
  paths: Record<string, Record<string, unknown>>;
}

export function buildOpenApiSpec(baseUrl: string): OpenApiSpec {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Notai REST API',
      version: '1.0.0',
      description:
        'Programmatic access to your Notai notes. Authenticate with a bearer API key from Settings → API keys. All requests are scoped to the key holder; keys carry the `notes:read` and/or `notes:write` scopes. Webhook events fire on create/update/archive — configure under Settings → Webhooks.',
    },
    servers: [
      { url: `${baseUrl}/api/v1`, description: 'Production' },
      { url: 'http://localhost:3000/api/v1', description: 'Local dev' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'nk_*' },
      },
      schemas: {
        Note: {
          type: 'object',
          required: ['id', 'title', 'kind', 'createdAt', 'updatedAt'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            icon: { type: 'string', nullable: true },
            kind: { type: 'string', enum: ['note', 'canvas', 'task', 'sticky'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        NoteCreate: {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 200 },
            plaintext: { type: 'string', maxLength: 200_000 },
            icon: { type: 'string', maxLength: 8, nullable: true },
            folderId: { type: 'string', nullable: true },
          },
        },
        NoteUpdate: {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 200 },
            plaintext: { type: 'string', maxLength: 200_000 },
            icon: { type: 'string', maxLength: 8, nullable: true },
          },
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: { error: { type: 'string' } },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid bearer token.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Token lacks the required scope.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Resource not found or not owned by the caller.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        BadRequest: {
          description: 'Invalid JSON or schema validation failure.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/notes': {
        get: {
          operationId: 'listNotes',
          summary: 'List your most recently updated notes',
          tags: ['Notes'],
          security: [{ bearerAuth: ['notes:read'] }],
          responses: {
            '200': {
              description: 'Up to 50 notes.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      notes: { type: 'array', items: { $ref: '#/components/schemas/Note' } },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
        post: {
          operationId: 'createNote',
          summary: 'Create a note',
          tags: ['Notes'],
          security: [{ bearerAuth: ['notes:write'] }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/NoteCreate' } },
            },
          },
          responses: {
            '201': {
              description: 'Created.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['id', 'title'],
                    properties: { id: { type: 'string' }, title: { type: 'string' } },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/notes/{id}': {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Note id.',
          },
        ],
        get: {
          operationId: 'getNote',
          summary: 'Fetch a note by id',
          tags: ['Notes'],
          security: [{ bearerAuth: ['notes:read'] }],
          responses: {
            '200': {
              description: 'The note.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { note: { $ref: '#/components/schemas/Note' } },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          operationId: 'updateNote',
          summary: 'Update title / icon / plaintext body',
          tags: ['Notes'],
          security: [{ bearerAuth: ['notes:write'] }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/NoteUpdate' } },
            },
          },
          responses: {
            '200': {
              description: 'Updated.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { note: { $ref: '#/components/schemas/Note' } },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          operationId: 'archiveNote',
          summary: 'Soft-delete (move to trash)',
          tags: ['Notes'],
          security: [{ bearerAuth: ['notes:write'] }],
          responses: {
            '200': {
              description: 'Archived.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
    },
  };
}
