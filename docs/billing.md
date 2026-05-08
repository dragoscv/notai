# Billing — Stripe Pro tier

Notai's Pro tier is delivered through Stripe Checkout + the Customer Portal.
Free is the default; the user's subscription state is mirrored into
`subscriptions` and `billing_events` tables for idempotent webhook handling.

## Setup

1. Create products in Stripe Dashboard:
   - **Notai Pro — Monthly** ($6 / month)
   - **Notai Pro — Yearly** ($60 / year)
2. Copy the price IDs into env:

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_PRO_MONTHLY=price_...
   STRIPE_PRICE_PRO_YEARLY=price_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

3. Configure the webhook in Stripe Dashboard → Developers → Webhooks:
   - URL: `https://notai.ro/api/stripe/webhook`
   - Events: `checkout.session.completed`,
     `customer.subscription.created`,
     `customer.subscription.updated`,
     `customer.subscription.deleted`,
     `invoice.payment_failed`

## Code paths

| File                                                  | Role                                      |
| ----------------------------------------------------- | ----------------------------------------- |
| `apps/web/src/server/stripe.ts`                       | Lazy Stripe client + price-id constants   |
| `apps/web/src/server/actions/billing.ts`              | `startCheckout`, `openBillingPortal`, `isPro` |
| `apps/web/src/app/api/stripe/webhook/route.ts`        | Signature-verified handler                |
| `apps/web/src/app/app/settings/billing/page.tsx`      | UI                                        |
| `packages/db/src/schema/billing.ts`                   | `subscriptions`, `billing_events` tables  |

## Gating Pro features

Use the `isPro(userId)` helper in any server action / route:

```ts
import { isPro } from '@/server/actions/billing';

if (!(await isPro(me.id))) {
  throw new Error('This feature requires Notai Pro');
}
```

Today, Pro gates these features (UI hides them on Free):

- "Ask my notes" RAG (free trial: 20 questions / month)
- Voice → text via Whisper (free trial: 30 minutes / month)
- Version history beyond 7 days

Free always keeps:

- Unlimited notes
- Realtime collaboration on up to 3 notes
- Web clipper, sticky widgets, drawing canvas, deep-link
- Cross-device sync via Hocuspocus

## Testing locally

Use Stripe's CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:15600/api/stripe/webhook
```

The CLI prints the signing secret — paste it into `STRIPE_WEBHOOK_SECRET` for
the dev session. Use Stripe's test card `4242 4242 4242 4242` for happy-path
checkouts.

## Idempotency

Every Stripe event is inserted into `billing_events(id PRIMARY KEY)` via
`onConflictDoNothing()` before we run the handler. Replays — common during
the first weeks of operation — never double-apply changes.
