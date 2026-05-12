# DNS deliverability — go-live checklist for notai.ro

> **Status as of last `check-dns-deliverability.mjs` run: ALL THREE
> RECORDS MISSING.** Until you complete steps 1–4 below every
> transactional email is at risk of spam-foldering or hard-bouncing.

This is the operator-facing companion to
[`email-deliverability.md`](./email-deliverability.md). Follow top to
bottom; total elapsed time is 15–60 minutes depending on DNS
propagation.

## 0. Prerequisites

- [ ] Resend dashboard access (you are the workspace owner).
- [ ] DNS access for `notai.ro` (likely Cloudflare given the .ro
      registrar — check `dig notai.ro NS`).
- [ ] An inbox at `dmarc@notai.ro` for receiving aggregate reports
      (or a forwarder to your real address).

## 1. Verify the sending domain in Resend

1. Resend dashboard → **Domains → Add domain → `notai.ro`**.
2. Resend will print **6 records**: 1 SPF (TXT), 3 DKIM (CNAME),
   and 1 MX + 1 TXT for inbound (only needed if you use Resend's
   inbound — we don't, skip those two).
3. Leave the page open; copy each record exactly as shown.

## 2. Add the DNS records

In your DNS provider (Cloudflare panel for most `.ro` domains via
`registrar.ro` / `rotld`):

- [ ] **SPF** — `TXT` on apex `notai.ro`, value from Resend (looks
      like `v=spf1 include:amazonses.com ~all`). If you already have
      an SPF record, **merge** into one — never publish two.
- [ ] **DKIM #1** — `CNAME` on `<sel1>._domainkey.notai.ro` →
      `<sel1>.dkim.amazonses.com.`
- [ ] **DKIM #2** — `CNAME` on `<sel2>._domainkey.notai.ro` → …
- [ ] **DKIM #3** — `CNAME` on `<sel3>._domainkey.notai.ro` → …
- [ ] **DMARC (start in monitor mode)** — `TXT` on
      `_dmarc.notai.ro`:
      ```
      v=DMARC1; p=none; rua=mailto:dmarc@notai.ro; fo=1; adkim=s; aspf=s
      ```

> If your DNS UI strips the trailing dot from CNAME values, that's
> usually fine — it normalizes internally.

## 3. Verify

Run the script (it covers all three records):

```powershell
node scripts/check-dns-deliverability.mjs --domain=notai.ro
```

Expected output:

```
✓ SPF: v=spf1 include:amazonses.com ~all
✓ DKIM[resend]: → <selector>.dkim.amazonses.com
! DMARC: p=none (monitor mode). Move to p=quarantine once aggregate reports look clean.
```

In the Resend dashboard the domain should turn **green / verified**
within 5 minutes (sometimes up to 1 hour depending on your registrar).

## 4. Smoke test

Send a real email through the app to your own inbox:

- [ ] Trigger a share invite or support reply via the app UI.
- [ ] Open the message in Gmail → **Show original** → confirm
      `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.
- [ ] Send a sample to https://www.mail-tester.com → expect ≥ 9/10.

## 5. Tighten DMARC (after 1–2 weeks)

After watching aggregate reports for a week and confirming only
legitimate sources pass alignment:

- [ ] Change DMARC `p=none` → `p=quarantine`.
- [ ] After another clean week: `p=quarantine` → `p=reject`.

Track this in a calendar reminder — it's the single biggest
deliverability lever once volume picks up.

## 6. Add to the launch checklist

Once all of the above is green:

- [ ] Re-run the verification script and paste the output into your
      launch tracker.
- [ ] Schedule the next run for 30 days from now (DNS records can be
      accidentally edited).
