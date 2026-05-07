/**
 * OAuth 2.1 / OIDC provider tables.
 *
 * notai acts as both an Authorization Server (RFC 8414) and a
 * Resource Server (RFC 9728) so MCP clients (Claude Desktop, Cursor,
 * other agents) can request scoped access to a user's notes.
 *
 *   - oauth_client   : registered apps that may request access
 *   - oauth_token    : authorization codes, access + refresh tokens
 *                      (sha256 hashed; raw values never persisted)
 *   - oauth_consent  : remembered user grant per (client, scopes) so
 *                      repeat authorizations skip the consent screen
 */
import { sql } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

export const oauthClientType = pgEnum('oauth_client_type', [
    'confidential', // server-to-server, has secret
    'public', // SPA / native app, PKCE only
]);

export const oauthTokenKind = pgEnum('oauth_token_kind', [
    'authorization_code',
    'access_token',
    'refresh_token',
]);

export const oauthClients = pgTable(
    'oauth_client',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        /** Public identifier sent in the OAuth flow. */
        clientId: text('client_id').notNull().unique(),
        /** sha256(secret), only set for `confidential` clients. */
        clientSecretHash: text('client_secret_hash'),
        type: oauthClientType('type').notNull().default('confidential'),
        name: text('name').notNull(),
        /** Optional descriptive text shown on the consent screen. */
        description: text('description'),
        logoUri: text('logo_uri'),
        clientUri: text('client_uri'),
        /** Allowed redirect URIs — exact match required (RFC 6749 §3.1.2). */
        redirectUris: jsonb('redirect_uris')
            .$type<string[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        /** Space-delimited scopes the client is permitted to request. */
        allowedScopes: text('allowed_scopes')
            .notNull()
            .default('openid profile email offline_access notes:read notes:write'),
        /** RFC 7591 dynamic registration markers. */
        dynamicallyRegistered: boolean('dynamically_registered').notNull().default(false),
        registrationAccessTokenHash: text('registration_access_token_hash'),
        /** Owner user (the person who registered this app); nullable for first-party. */
        ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
    },
    (t) => [index('oauth_client_owner_idx').on(t.ownerId)],
);

export const oauthTokens = pgTable(
    'oauth_token',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        clientId: text('client_id')
            .notNull()
            .references(() => oauthClients.id, { onDelete: 'cascade' }),
        userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
        kind: oauthTokenKind('kind').notNull(),
        /** sha256(token) — fast equality lookup; raw token never stored. */
        tokenHash: text('token_hash').notNull().unique(),
        /**
         * All tokens descending from one user grant share a family id.
         * Replay of a consumed refresh token revokes the entire family
         * (defense against stolen-token replay, RFC 6749 §10.4).
         */
        tokenFamilyId: text('token_family_id').notNull(),
        scopes: text('scopes').notNull().default(''),
        codeChallenge: text('code_challenge'),
        codeChallengeMethod: text('code_challenge_method'),
        redirectUri: text('redirect_uri'),
        /** Optional metadata — currently used for nonce + resource indicators. */
        metadata: jsonb('metadata')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        consumedAt: timestamp('consumed_at', { withTimezone: true }),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        index('oauth_token_client_idx').on(t.clientId),
        index('oauth_token_user_idx').on(t.userId),
        index('oauth_token_kind_idx').on(t.kind),
        index('oauth_token_family_idx').on(t.tokenFamilyId),
    ],
);

/**
 * Remembered consent — when a user has already granted a client
 * a set of scopes, future authorize requests for the same (or a
 * subset of) scopes can skip the consent UI.
 */
export const oauthConsents = pgTable(
    'oauth_consent',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        clientId: text('client_id')
            .notNull()
            .references(() => oauthClients.id, { onDelete: 'cascade' }),
        scopes: text('scopes').notNull().default(''),
        /** Bumped on every grant so a revoke can invalidate prior tokens. */
        version: integer('version').notNull().default(1),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
    },
    (t) => [uniqueIndex('oauth_consent_user_client_unq').on(t.userId, t.clientId)],
);

export type OauthClient = typeof oauthClients.$inferSelect;
export type OauthToken = typeof oauthTokens.$inferSelect;
export type OauthConsent = typeof oauthConsents.$inferSelect;
