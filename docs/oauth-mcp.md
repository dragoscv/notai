# OAuth 2.1 + MCP integration

notai exposes itself as an **OAuth 2.1 authorization server** and an
**MCP (Model Context Protocol) resource server** so that other apps and
AI agents can read or write your notes on your behalf with a scoped,
revocable grant.

This document explains:

1. What endpoints exist and what they do
2. How any OAuth/MCP client can integrate
3. A specific recipe for connecting **metu** (`E:\gh\metu`) to notai

---

## 1. Endpoints

All endpoints are mounted under the web app's origin (e.g.
`https://notai.app` or `http://localhost:15600` in dev).

### Discovery (well-known)

| URL                                                | Purpose                            | Spec                |
| -------------------------------------------------- | ---------------------------------- | ------------------- |
| `/.well-known/oauth-authorization-server`          | Authorization-server metadata      | RFC 8414            |
| `/.well-known/openid-configuration`                | OIDC discovery (alias of the above) | OIDC Discovery 1.0  |
| `/.well-known/oauth-protected-resource`            | Protected-resource metadata (MCP) | RFC 9728            |

MCP-aware clients only need to know the MCP URL (`/api/mcp`) — they
discover everything else from the `WWW-Authenticate` header on the first
unauthenticated 401.

### OAuth flow

| URL                              | Method | Purpose                                  |
| -------------------------------- | ------ | ---------------------------------------- |
| `/api/oauth/register`            | POST   | RFC 7591 dynamic client registration     |
| `/api/oauth/authorize`           | GET    | Consent screen (server-rendered)         |
| `/api/oauth/authorize/decide`    | POST   | Form target — issues authorization code  |
| `/api/oauth/token`               | POST   | `authorization_code`, `refresh_token`    |
| `/api/oauth/revoke`              | POST   | RFC 7009 token revocation                |
| `/api/oauth/userinfo`            | GET    | OIDC UserInfo (returns `sub`, `name`, …) |

### Resource

| URL          | Auth                | Purpose                                   |
| ------------ | ------------------- | ----------------------------------------- |
| `/api/mcp`   | `Authorization: Bearer <access_token>` | MCP Streamable HTTP endpoint |

---

## 2. Scopes

| Scope             | Grants                                                      |
| ----------------- | ----------------------------------------------------------- |
| `openid`          | `sub` (user id) via UserInfo                                |
| `profile`         | name, picture                                               |
| `email`           | email + verified flag                                       |
| `offline_access`  | issue a refresh token                                       |
| `notes:read`      | list / search / read notes and folders                      |
| `notes:write`     | create + update notes and folders                           |
| `notes:delete`    | archive notes (soft delete)                                 |
| `folders:read`    | read folders only                                           |
| `folders:write`   | create / rename folders                                     |
| `mcp`             | umbrella scope — call any MCP tool the token can otherwise reach |

Tools enforce both their fine-grained scope and `mcp` as an allowlist.

---

## 3. Authorization Code + PKCE flow

PKCE is **required for every client** (OAuth 2.1).

```
client                         notai (auth server)               user
  │                                  │                              │
  │  GET /authorize?response_type=code                              │
  │      client_id=…&redirect_uri=…&scope=…&state=…                 │
  │      code_challenge=<S256(verifier)>&code_challenge_method=S256 │
  │ ───────────────────────────────► │                              │
  │                                  │  ── consent UI ───────────►  │
  │                                  │  ◄── allow ────────────────  │
  │  302 redirect_uri?code=…&state=…&iss=…                          │
  │ ◄─────────────────────────────── │                              │
  │                                                                 │
  │  POST /token                                                    │
  │   grant_type=authorization_code                                 │
  │   code=…&redirect_uri=…&code_verifier=…                         │
  │   (+ client_secret for confidential clients)                    │
  │ ───────────────────────────────► │                              │
  │  200 { access_token, refresh_token?, expires_in, scope }        │
  │ ◄─────────────────────────────── │                              │
```

Refresh:

```
POST /token grant_type=refresh_token refresh_token=…
↓ rotates the refresh token (RFC 6749 §6) — old one is consumed
```

Replay of a consumed refresh token revokes the entire token family
(RFC 6749 §10.4 — defence against stolen tokens).

---

## 4. MCP transport

`/api/mcp` implements the **Streamable HTTP** transport from MCP
revision **2025-06-18**.

- `POST /api/mcp` with a JSON-RPC 2.0 message → JSON response
- `DELETE /api/mcp` → 204 (stateless server, no session to clear)
- `GET /api/mcp` → 405 with the `WWW-Authenticate` header that points
  to `/.well-known/oauth-protected-resource`

`initialize` and `ping` are unauthenticated (lets clients negotiate the
protocol before they have a token). Everything else requires
`Authorization: Bearer <access_token>`.

### Tools exposed

| Tool                     | Required scope          | Description                     |
| ------------------------ | ----------------------- | ------------------------------- |
| `me`                     | `openid`                | identity of the token's user    |
| `notes.list`             | `notes:read`            | list notes (filters)            |
| `notes.search`           | `notes:read`            | substring search                |
| `notes.get`              | `notes:read`            | full plaintext + metadata       |
| `notes.create`           | `notes:write`           | new note                        |
| `notes.update`           | `notes:write`           | mutate fields                   |
| `notes.archive`          | `notes:write`           | soft-delete                     |
| `notes.listTags`         | `notes:read`            | tags attached to a note         |
| `notes.tag`              | `notes:write`           | attach a tag to a note          |
| `notes.untag`            | `notes:write`           | detach a tag from a note        |
| `notes.listAttachments`  | `notes:read`            | uploaded files for a note       |
| `folders.list`           | `folders:read`          | flat list of folders            |
| `folders.create`         | `folders:write`         | new folder                      |
| `tags.list`              | `notes:read`            | all tags for the user           |
| `tags.create`            | `notes:write`           | create a tag (or reuse by name) |
| `share.enable`           | `notes:write`           | turn on public read-only link   |
| `share.disable`          | `notes:write`           | revoke the public link          |
| `share.status`           | `notes:read`            | current public-share state      |

Holding the umbrella `mcp` scope is also accepted in lieu of the tool's
specific scope.

---

## 5. Connecting **metu** (`E:\gh\metu`) to notai

metu is the AI second-brain that wants to **call notai's MCP tools** so
agents (Claude Desktop, Cursor, internal Conductor) can read/write your
notes.

There are two integration shapes — pick whichever you want; they're
independent.

### Shape A — metu uses notai's MCP server directly (recommended)

A single MCP server registration in metu makes notai's tools available
inside metu's broader tool catalogue. metu acts as an OAuth client to
notai.

1. **In notai → Settings → Connected apps → Developer**, register a
   client:
   - Name: `metu`
   - Redirect URIs (one per line):
     - `https://metu.example.com/api/integrations/notai/callback`
     - `http://localhost:15600/api/integrations/notai/callback` (for dev)
   - Type: **Confidential**
   - Allowed scopes: `openid profile email offline_access notes:read notes:write notes:delete folders:read folders:write mcp`

   Copy the `client_id` and `client_secret` (shown once).

2. **In metu**, add a new OAuth app (`apps/web/src/app/api/oauth/[appId]/start`):

   ```ts
   // packages/db/seed.ts or via the metu admin UI
   await createOauthApp({
     workspaceId,
     name: 'notai',
     slug: 'notai',
     authorizeUrl: 'https://notai.app/api/oauth/authorize',
     tokenUrl: 'https://notai.app/api/oauth/token',
     userinfoUrl: 'https://notai.app/api/oauth/userinfo',
     revokeUrl: 'https://notai.app/api/oauth/revoke',
     discoveryUrl: 'https://notai.app/.well-known/oauth-authorization-server',
     clientId: '<from step 1>',
     clientSecret: '<from step 1>', // metu encrypts at rest
     scopes: 'openid profile email offline_access notes:read notes:write mcp',
     pkce: true,
   });
   ```

3. **Trigger the flow** from metu — visit `/api/oauth/notai/start`.
   metu redirects to notai's `/api/oauth/authorize`, the user consents,
   and metu's `/api/oauth/notai/callback` exchanges the code at notai's
   `/api/oauth/token` (PKCE verifier + client secret).

4. metu now stores the access + refresh token in `oauth_connection`
   (encrypted). Use them as Bearer tokens against `https://notai.app/api/mcp`.

5. **Wire notai into metu's MCP tool catalogue.** Whatever metu's
   gateway looks like (HTTP relay, SDK pass-through, Conductor tool
   routing), add an entry like:

   ```ts
   {
     name: 'notai',
     transport: { type: 'http', url: 'https://notai.app/api/mcp' },
     auth: { kind: 'oauth_connection', connectionId: '<uuid>' },
   }
   ```

   The metu tool router fetches the access token from
   `oauth_connection`, refreshes if expired, and forwards JSON-RPC to
   notai with the bearer header.

### Shape B — Claude Desktop / Cursor talks directly to notai

For this you don't need metu at all — but it's how an end user can prove
the server works.

Add to `claude_desktop_config.json` (or VS Code's `mcp.json`):

```json
{
  "mcpServers": {
    "notai": {
      "url": "https://notai.app/api/mcp"
    }
  }
}
```

The client will discover the auth server from the 401 challenge,
register itself dynamically (`POST /api/oauth/register`), open a
browser tab to `/api/oauth/authorize`, capture the code on its loopback
listener, and exchange it for a token. Done.

---

## 6. Testing locally

```pwsh
# 1. Start the local stack
pnpm docker:up
pnpm --filter @notai/db migrate
pnpm dev

# 2. Discovery
curl http://localhost:15600/.well-known/oauth-authorization-server
curl http://localhost:15600/.well-known/oauth-protected-resource

# 3. Dynamic registration
curl -X POST http://localhost:15600/api/oauth/register `
  -H "content-type: application/json" `
  -d '{
    "client_name": "test client",
    "redirect_uris": ["http://localhost:8765/callback"],
    "token_endpoint_auth_method": "client_secret_post"
  }'

# 4. Open browser to start the flow:
#    http://localhost:15600/api/oauth/authorize
#      ?response_type=code
#      &client_id=<from step 3>
#      &redirect_uri=http://localhost:8765/callback
#      &scope=openid+notes:read+notes:write+offline_access+mcp
#      &state=xyz
#      &code_challenge=<S256(verifier)>
#      &code_challenge_method=S256
```

The test code in [docs/oauth-mcp-curl-examples.sh](./oauth-mcp-curl-examples.sh)
(if you want to add it) walks through the full flow.

---

## 7. Threat model — what we do (and don't)

✅  PKCE required for every client (OAuth 2.1).
✅  Refresh-token rotation + family-revocation on replay.
✅  Tokens are sha256-hashed before storage; the raw never round-trips.
✅  Client secrets are sha256-hashed.
✅  Exact-match `redirect_uri` (no wildcards).
✅  Auth-code TTL: 60 s. Access token: 1 h. Refresh: 30 d.
✅  WWW-Authenticate header on 401 + 403 with `resource_metadata` so MCP
    clients can self-bootstrap (RFC 9728 §5.1).

❌  No id_token signing (UserInfo is the canonical identity surface).
❌  No device-code grant (add later if a TV/CLI client needs it).
❌  No JWE encrypted access tokens — opaque tokens with DB lookup.
❌  No rate-limiting at the OAuth layer (add behind a reverse proxy).
