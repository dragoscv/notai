# Asset Storage

Notai stores user-uploaded images, PDFs and other inline attachments in any
S3-compatible object store. We've validated **Cloudflare R2** and **Google
Cloud Storage with HMAC keys**; AWS S3 will work too with `ASSETS_PROVIDER=s3`.

The storage layer is a hand-rolled SigV4 client (`apps/web/src/server/storage/s3.ts`)
to keep the bundle small — pulling in the AWS SDK adds ~500 KB to every server
function we don't need.

## Configuration

```env
ASSETS_PROVIDER=r2|gcs|s3
ASSETS_BUCKET=notai-assets
ASSETS_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
ASSETS_REGION=auto
ASSETS_ACCESS_KEY_ID=
ASSETS_SECRET_ACCESS_KEY=
# Public CDN base URL. If unset, files fall back to <endpoint>/<bucket>/<key>.
ASSETS_PUBLIC_BASE_URL=https://assets.notai.ro
```

When **all** of `ASSETS_BUCKET`, `ASSETS_ENDPOINT`, `ASSETS_ACCESS_KEY_ID`, and
`ASSETS_SECRET_ACCESS_KEY` are present, `isAssetsConfigured()` returns true and
the asset uploader UI activates. Otherwise the editor's image button stays
hidden.

## Cloudflare R2 setup

1. Create a bucket `notai-assets`.
2. **Settings → Public access → Custom domain** → bind `assets.notai.ro` to
   the bucket. Cloudflare auto-issues a cert.
3. **R2 → Manage R2 API tokens** → create a token scoped to `Object Read & Write`
   on this bucket only. Copy the access key + secret.
4. Set `ASSETS_REGION=auto` and the public base URL to your custom domain.

## Google Cloud Storage with HMAC keys

1. Enable the GCS API on your project.
2. Create a service account with `Storage Object Admin` on the bucket only.
3. **Storage → Settings → Interoperability → HMAC keys** → create one for that
   service account. Use the access ID + secret in the env vars.
4. `ASSETS_ENDPOINT=https://storage.googleapis.com`, `ASSETS_REGION=auto`.

## Upload flow

1. Browser calls the `startAssetUpload` server action with `noteId`, `filename`,
   `mime`, `sizeBytes`.
2. The server validates (allowed MIME, ≤25 MB), generates a key
   `notes/<noteId>/<owner>/<random>-<filename>`, and presigns a `PUT` URL with
   a 5-minute expiry.
3. The browser PUTs the file directly to the bucket — never through Notai's
   server.
4. The browser calls `finishAssetUpload` to record the `assets` row.
5. The editor inserts the public URL via `editor.chain().setImage()`.

## Cleanup

Soft-deleted notes have their assets purged when the trash cron runs. The
purge job lists `assets` rows by `note_id` and issues `DELETE` requests to the
bucket — failures are logged but never block the trash purge.

## Local development

Without `ASSETS_*` set, the uploader UI is hidden and image insertion via the
editor falls back to the toolbar's URL prompt (you paste a public URL). For a
true local round-trip, run [`minio`](https://min.io) on port 9000 and point
`ASSETS_ENDPOINT` at it.
