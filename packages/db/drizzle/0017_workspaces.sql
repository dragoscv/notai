-- 0017_workspaces
-- Multi-user team spaces + shared folders + email invites.

CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

CREATE TABLE workspaces (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  owner_id    text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE workspace_members (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  role         workspace_role NOT NULL DEFAULT 'editor',
  invited_at   timestamptz NOT NULL DEFAULT NOW(),
  accepted_at  timestamptz
);
CREATE UNIQUE INDEX workspace_members_unq ON workspace_members (workspace_id, user_id);
CREATE INDEX workspace_members_user_idx ON workspace_members (user_id);

CREATE TABLE shared_folders (
  folder_id    text NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role         workspace_role NOT NULL DEFAULT 'editor',
  shared_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX shared_folders_unq ON shared_folders (folder_id, workspace_id);
CREATE INDEX shared_folders_workspace_idx ON shared_folders (workspace_id);

CREATE TABLE workspace_invites (
  id             text PRIMARY KEY,
  workspace_id   text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email          text NOT NULL,
  role           workspace_role NOT NULL DEFAULT 'editor',
  invited_by_id  text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  token          text NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX workspace_invites_ws_email_unq ON workspace_invites (workspace_id, email);
