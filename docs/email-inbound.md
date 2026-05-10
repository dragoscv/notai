# Email-to-note (inbound)

Notai supports turning emails into notes. Each user gets a secret address
of the form `local+TOKEN@in.notai.app`. The subject becomes the note title,
the body becomes the note content. Only mail from the user's account email
is accepted (rejecting trivial spoofing).

## Provider

The webhook handler at `POST /api/inbound-email` accepts a Postmark
[Inbound Webhook](https://postmarkapp.com/developer/webhooks/inbound-webhook)
JSON payload, but any provider that posts the same shape works
(Mailgun parsed routes, SES → Lambda → webhook).

## Setup

1. Pick an inbound subdomain (e.g. `in.notai.app`).
2. Provision an inbound stream with your provider and add the MX records.
3. Set the webhook URL to `https://<your-host>/api/inbound-email`.
4. Configure HTTP basic auth or an `Authorization: Bearer …` header on the
   webhook with a long random secret.
5. Set these env vars on the web app:

   ```env
   EMAIL_INBOUND_DOMAIN=in.notai.app
   EMAIL_INBOUND_WEBHOOK_SECRET=<the long random secret>
   ```

6. Deploy. Users can grab their address from `/app/email-in`.

## Security notes

- The bearer token is compared in constant time.
- Routing token is opaque (16 random bytes, URL-safe base64).
- Sender is verified against the user's account email — Postmark validates
  the From header before delivery, so this is sufficient for v1.
- Bodies are capped at 64 KB; HTML is stripped to plain text.
- Attachments are not yet stored; add a follow-up to push them through the
  asset pipeline.
- Rotate the routing token from `/app/email-in` if it leaks.

## Local testing

```bash
curl -X POST http://localhost:3000/api/inbound-email \
  -H "Authorization: Bearer $EMAIL_INBOUND_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "FromFull": { "Email": "you@example.com" },
    "ToFull":   [{ "Email": "you+TOKEN@in.notai.app", "MailboxHash": "TOKEN" }],
    "Subject":  "Hello from email",
    "TextBody": "This becomes a new note."
  }'
```
