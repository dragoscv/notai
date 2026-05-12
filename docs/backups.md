# Backups

Production Postgres is backed up nightly by
[`.github/workflows/db-backup-nightly.yml`](../.github/workflows/db-backup-nightly.yml).

## Schedule

- Cron: `30 2 * * *` UTC (every day at 02:30 UTC)
- Manual: GitHub → Actions → "db-backup-nightly" → "Run workflow"

## Where backups go

1. **Always** — uploaded as a workflow artifact named
   `notai-db-backup-<timestamp>`. Retention: 30 days. Download from
   the workflow run page.
2. **If configured** — also uploaded to
   `gs://$GCS_BACKUP_BUCKET/notai/<YYYY>/<MM>/<DD>/notai-<ts>.dump`.
   Apply a GCS lifecycle policy for long-term retention (e.g. keep
   one dump per week for a year).

Each artifact also contains a `.sha256` file. Verify before restoring:

```bash
sha256sum --check notai-<ts>.dump.sha256
```

## Required repo secrets

| Secret                    | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `DATABASE_URL_PRODUCTION` | Direct (NOT pooled) Postgres URL for `pg_dump`       |

## Optional repo secrets (for GCS upload)

| Secret              | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `GCP_SA_KEY`        | Service-account JSON with `roles/storage.objectCreator`       |
| `GCS_BACKUP_BUCKET` | Bucket name (no `gs://` prefix), e.g. `notai-db-backups`      |

> **Why direct, not pooled?** `pg_dump` uses Postgres's binary `COPY`
> protocol, which Neon's pooler (PgBouncer) refuses. Use the
> `?sslmode=require` direct URL from the Neon console.

## Restoring

Local round-trip:

```powershell
# 1. Download the .dump artifact from the workflow run.
# 2. Restore into your local Docker Postgres:
node scripts/restore-backup.mjs --file=.\notai-20260101T023000Z.dump --target=local --clean
```

Production (last-resort, irreversible):

```powershell
node scripts/restore-backup.mjs `
  --file=.\notai-20260101T023000Z.dump `
  --target=production `
  --clean
# You will be prompted to type "restore" before anything is written.
```

Schema-only or data-only restores:

```powershell
node scripts/restore-backup.mjs --file=… --target=local --schema-only
node scripts/restore-backup.mjs --file=… --target=local --data-only
```

## Automated monthly drill

[`db-backup-restore-drill.yml`](../.github/workflows/db-backup-restore-drill.yml)
runs on the first day of every month. It:

1. Finds the latest successful `db-backup-nightly` run.
2. Downloads the artifact and verifies its `.sha256`.
3. Spins up Postgres 17 inside the runner.
4. Calls `node scripts/backup-restore-drill.mjs --file=…` which
   creates a throwaway DB, `pg_restore`s into it, then verifies:
   - `>= DRILL_MIN_TABLES` tables in `public` (default 30)
   - `drizzle.__drizzle_migrations` is populated
   - core tables exist (`users`, `notes`, `sessions`, `webhook_endpoints`)

Run it manually any time:

```powershell
# Locally, against any Postgres where you can CREATE DATABASE:
$env:DRILL_DATABASE_URL = "postgres://postgres:t@localhost:5432/postgres"
node scripts/backup-restore-drill.mjs --file=.\notai-<ts>.dump
```

A failed drill is the loudest possible "your backups are not actually
recoverable" alarm — treat it as P0.

## Verifying a backup is healthy

The workflow stores the SHA-256 alongside the dump. To smoke-test
the dump itself, restore into a throwaway local DB and run a few
sanity selects:

```powershell
docker run --rm -d --name notai-restore-check -e POSTGRES_PASSWORD=t -p 15699:5432 postgres:17
$env:DATABASE_URL = "postgres://postgres:t@localhost:15699/postgres"
node scripts/restore-backup.mjs --file=.\notai-<ts>.dump --target=local --yes
# Quick sanity:
psql $env:DATABASE_URL -c "select count(*) from \"user\";"
docker stop notai-restore-check
```

## What's NOT backed up here

- **Yjs document blobs in the realtime server** — currently stored in
  Postgres via `@hocuspocus/extension-database`, so they ARE in the
  dump. If you switch storage backends, add a separate backup job.
- **S3 / object storage** — assets uploaded via the storage SigV4
  presign flow live in the bucket, not Postgres. Configure a bucket
  versioning + lifecycle rule directly on the provider for those.
- **Stripe / Resend state** — sources of truth live in the providers'
  own databases. Webhook deliveries are replayable from their
  dashboards.
