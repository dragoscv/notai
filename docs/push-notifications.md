# Web Push Notifications

Notai supports daily-review push notifications via the standard W3C
Web Push API. The receive path lives in the web app
(`apps/web/public/sw-push.js` + `/app/settings/notifications`); the
send path is a Vercel cron at `/api/cron/push-daily-review`.

## 1. Generate VAPID keys (one-time)

```powershell
node scripts/generate-vapid-keys.mjs
```

The script prints four env lines. Add them to:

- `apps/web/.env.local` for local development
- The Vercel project (`Settings → Environment Variables`) for production

```
VAPID_PUBLIC_KEY=<base64url>
VAPID_PRIVATE_KEY=<base64url>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same as VAPID_PUBLIC_KEY>
VAPID_SUBJECT=mailto:you@yourdomain.com
```

The public key is exposed to the browser so it can subscribe; the
private key is server-only.

## 2. Authorize the cron

Set `CRON_SECRET` in Vercel and the matching token in your cron
provider. Vercel Cron handles this automatically when the value is
set on the project. Local dev: omit `CRON_SECRET` to allow open
calls, or hit
`/api/cron/push-daily-review?secret=<value>`.

## 3. Subscribe a browser

1. Sign in.
2. Visit `/app/settings/notifications`.
3. Click **Enable push notifications**, accept the browser prompt.

The subscription is persisted in `push_subscriptions`. Disable any
time from the same toggle.

## 4. Trigger a send (manually, for testing)

```powershell
curl "https://your-domain/api/cron/push-daily-review?secret=$env:CRON_SECRET"
```

Response:

```json
{ "sent": 12, "pruned": 1, "errors": 0 }
```

`pruned` counts subscriptions whose endpoints returned 404/410
(expired devices); they are removed from the table automatically.

## Troubleshooting

- **Toggle says "Push notifications aren't configured on this
  deployment."** → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is missing. Restart
  `pnpm dev` after editing `.env.local`.
- **`sendNotification` fails with 401** → server-side keys
  (`VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`) don't match the public
  key the browser used to subscribe. Re-subscribe from the toggle.
- **Notifications never arrive** → check the OS-level notification
  permission for the browser (Windows Settings, macOS System
  Settings); silent / Focus modes will block them.
