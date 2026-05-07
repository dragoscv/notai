-- Enable extensions needed by Notai
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- trigram full-text search on notes.plaintext
CREATE EXTENSION IF NOT EXISTS "btree_gin";
