# Email deliverability runbook

Outbound email goes through [Resend](https://resend.com). Inbound email is
documented separately in [`email-inbound.md`](./email-inbound.md).

## Sending domain

- **Domain:** `notai.ro`
- **From address:** `Notai <noreply@notai.ro>` (override with `CONTACT_FROM`).
- **Webhook:** Resend → `/api/webhooks/resend` populates the suppression list
  on bounces and complaints. See
  [`apps/web/src/server/email-suppressions.ts`](../apps/web/src/server/email-suppressions.ts).

## Required DNS records

All three must exist on the sending domain. Resend will refuse to deliver
if **DKIM** is missing, and Gmail/Outlook will silently spam-fold if
**SPF** or **DMARC** are missing.

### 1. SPF (TXT on apex)

```
notai.ro.  IN TXT  "v=spf1 include:amazonses.com -all"
```

> Resend currently sends through Amazon SES; the include is provided in the
> Resend dashboard under *Domains → notai.ro → SPF*. Use the value from
> the dashboard verbatim — it changes if Resend migrates infrastructure.

### 2. DKIM (CNAME × 3)

Resend prints three `CNAME` records in the dashboard, one per selector:

```
resend._domainkey.notai.ro.   IN CNAME   <selector>.dkim.amazonses.com.
…
```

Add all three. The Resend dashboard turns the row green once propagation
completes (usually under 5 minutes on a sane DNS provider).

### 3. DMARC (TXT on `_dmarc`)

```
_dmarc.notai.ro.  IN TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@notai.ro; ruf=mailto:dmarc@notai.ro; fo=1; adkim=s; aspf=s"
```

- Start with `p=none` for 1–2 weeks while you watch the aggregate
  reports (`rua`).
- Move to `p=quarantine` once you see only legitimate sources passing
  alignment.
- Move to `p=reject` only after a clean week at quarantine.

## Verification

Use the helper script — it resolves the live records and flags missing
or malformed values without external dependencies:

```powershell
node scripts/check-dns-deliverability.mjs --domain=notai.ro
```

Manually:

```powershell
# SPF
nslookup -type=TXT notai.ro
# DMARC
nslookup -type=TXT _dmarc.notai.ro
# DKIM (one per selector — replace XYZ with the selector Resend issued)
nslookup -type=CNAME XYZ._domainkey.notai.ro
```

External tools:

- <https://www.mail-tester.com> — send `noreply@notai.ro` a sample,
  expect ≥ 9/10.
- <https://dmarcian.com/dmarc-inspector/> — inspect the parsed DMARC
  record.
- Resend dashboard → Domains → ✓ marks all three rows green.

## Warmup checklist

If `notai.ro` was previously cold or moved off another ESP:

1. Day 1–3: ≤ 50 transactional emails / day to known-good recipients
   (your own inbox, support replies).
2. Day 4–7: ramp to ≤ 200 / day; watch the Resend reputation tab.
3. Day 8–14: ramp to ≤ 1 000 / day; enable workspace-digest cron once
   you see > 95% delivered + < 0.1% complaint rate.
4. After 14 days: full volume; flip DMARC to `p=quarantine`.

## On bounce / complaint

The Resend webhook auto-adds the address to
`email_suppressions`. `sendEmail()` short-circuits suppressed addresses
before calling Resend. To re-enable a recipient (after they confirm in
support), delete the row manually:

```sql
delete from email_suppressions where lower(email) = lower('user@example.com');
```

## Common failure modes

- **"Domain not verified" 403 from Resend** → DKIM CNAMEs missing or
  the apex `MX` record interferes. Re-check Resend dashboard.
- **Mail lands in spam** → SPF or DMARC missing; or `From` address
  doesn't match the verified domain.
- **DMARC failing for forwarded mail** → expected (forwarding breaks
  SPF). Make sure `aspf=s` is `r` only if you rely on forwarding.
