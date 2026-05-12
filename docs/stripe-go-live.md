# Stripe billing — go-live checklist

Reference: [`apps/web/src/app/api/stripe/webhook/route.ts`](../apps/web/src/app/api/stripe/webhook/route.ts),
[`apps/web/src/server/billing/checkout.ts`](../apps/web/src/server/billing/checkout.ts).

## Mode safety

The codebase has **no test/live toggle** — whatever `STRIPE_SECRET_KEY`
is in env wins. To prevent a test key reaching production:

- `getStripe()` now logs a loud `WARNING` once if a `sk_test_*` key
  loads under `NODE_ENV=production`. Watch for it in Vercel logs after
  every prod deploy that touches billing.
- Consider adding a `STRIPE_KEY_MODE_GUARD=live` env var + a refusal
  on mismatch if you want it to crash instead of warn.

## Required env vars (production)

| Var                          | Notes                                                            |
| ---------------------------- | ---------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`          | Live mode `sk_live_…`                                            |
| `STRIPE_WEBHOOK_SECRET`      | From Dashboard → Developers → Webhooks → endpoint `whsec_…`      |
| `STRIPE_PRICE_PRO_MONTHLY`   | Optional override; admin/plans page can sync prices automatically |
| `STRIPE_PRICE_PRO_YEARLY`    | Same                                                             |
| `NEXT_PUBLIC_APP_URL`        | Used in the dunning + trial-end emails                           |

## Webhook events we handle

Configure the production endpoint at
`https://notai.ro/api/stripe/webhook` to send these events:

- [x] `checkout.session.completed`        — first paid sub, redeems referral
- [x] `customer.subscription.created`     — sync to `subscriptions` row
- [x] `customer.subscription.updated`     — status / price / trial changes
- [x] `customer.subscription.deleted`     — sets tier=free
- [x] `customer.subscription.trial_will_end` — 3-day warning email
- [x] `invoice.payment_failed`            — sets status=past_due + dunning email
- [x] `charge.refunded`                   — audited via `billing_events` (no UI)
- [x] `charge.dispute.created`            — audited
- [x] `charge.dispute.closed`             — audited

Unhandled (intentionally): `invoice.paid`/`invoice.payment_succeeded`
(receipts handled by Stripe-hosted email + Customer Portal); generic
`customer.updated`.

Idempotency is enforced by `billing_events` — replays are safe.

## Manual test plan (run before flipping the switch)

In the **Stripe test dashboard** (NOT live):

1. **Happy path checkout**
   - [ ] `/app/settings/billing` → "Start Pro trial".
   - [ ] Use card `4242 4242 4242 4242` exp 12/34, any CVC.
   - [ ] Verify webhook delivered + `subscriptions` row has
         `tier='pro'` and `status='trialing'`.

2. **Trial → paid transition**
   - [ ] In Stripe dashboard, edit the subscription → set
         `trial_end` to "now". Webhook fires
         `customer.subscription.updated`.
   - [ ] Verify our DB shows `status='active'` and `trialEndsAt` is
         in the past.

3. **Trial-ending warning**
   - [ ] Create a fresh test sub.
   - [ ] In dashboard → "Send test webhook" →
         `customer.subscription.trial_will_end`.
   - [ ] Verify the user receives the "Your Notai trial ends soon"
         email.

4. **Payment failure / dunning**
   - [ ] Subscribe with card `4000 0000 0000 9995` (fails on
         renewal).
   - [ ] In dashboard → advance the subscription → renewal attempt
         fires `invoice.payment_failed`.
   - [ ] Verify: `subscriptions.status='past_due'` AND user
         received the "Action required" email.

5. **Cancellation**
   - [ ] In Customer Portal → cancel.
   - [ ] Verify `cancel_at_period_end=1` in DB.
   - [ ] Advance the clock to period end → expect
         `customer.subscription.deleted` → `tier='free'`.

6. **Refund (audit only)**
   - [ ] Refund a charge in dashboard → expect a `billing_events`
         row with `type='charge.refunded'`. No UI surface yet.

## Production cutover

1. [ ] In Stripe dashboard, **toggle Test mode off**.
2. [ ] Create the live webhook endpoint pointing at
       `https://notai.ro/api/stripe/webhook` with the 9 events above.
3. [ ] Copy the live `whsec_…` secret into Vercel env
       (`STRIPE_WEBHOOK_SECRET`) for **Production only**.
4. [ ] Copy the live `sk_live_…` key into
       `STRIPE_SECRET_KEY` for **Production only**. Keep test keys
       on Preview & Development.
5. [ ] Trigger a redeploy on Vercel so Next picks up the new env.
6. [ ] Watch the Vercel logs for the `[stripe] WARNING: ... TEST mode key`
       line — should NOT appear.
7. [ ] Make a real €1 charge with your own card, verify everything,
       then refund yourself in the dashboard.

## Known gaps (not launch-blockers, track for v2)

- No invoice/receipt persistence in our DB; users use the Customer
  Portal. Add an `invoices` table if you ever want in-app receipt
  history.
- `past_due` keeps the user on Pro tier through the Stripe retry
  window (~21 days). This is intentional — we don't want to revoke
  features the moment a card declines. Stripe will downgrade via
  `customer.subscription.deleted` once retries exhaust.
- No automated dunning escalation beyond the first
  `invoice.payment_failed` email. If you want a 3-day / 7-day / final
  reminder cadence, hook it off `invoice.payment_failed` event_count
  or a daily cron on `subscriptions.status='past_due'`.
- `charge.dispute.*` events log only. Set up a Slack webhook from
  Stripe directly for instant operator notification.
