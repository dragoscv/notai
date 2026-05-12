#!/usr/bin/env node
/**
 * Deliverability DNS check for the notai sending domain.
 *
 * Verifies the three records that any modern inbox provider (Gmail,
 * Outlook, Apple) requires before it stops spam-foldering you:
 *   - SPF  (TXT on the apex; must include the ESP and end with -all/~all)
 *   - DKIM (CNAME on `<selector>._domainkey.<domain>`; one per selector
 *           Resend issued — pass --selectors=resend to check all of them)
 *   - DMARC (TXT on `_dmarc.<domain>`; must specify a policy)
 *
 * Usage:
 *   node scripts/check-dns-deliverability.mjs --domain=notai.ro
 *   node scripts/check-dns-deliverability.mjs --domain=notai.ro --selectors=resend,resend2
 *
 * Exit codes:
 *   0  all required records present and well-formed
 *   1  any record missing or malformed
 *
 * Pure Node + node:dns/promises — no extra deps.
 */
import dns from 'node:dns/promises';

const argv = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    if (!a.startsWith('--')) return [];
    const [k, v] = a.slice(2).split('=');
    return [[k, v ?? true]];
  }),
);

const domain = String(argv.domain ?? 'notai.ro').toLowerCase();
const selectors = String(argv.selectors ?? 'resend')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`▶ deliverability check for ${domain}`);

let ok = true;

// SPF
try {
  const txt = (await dns.resolveTxt(domain)).map((r) => r.join(''));
  const spf = txt.find((t) => t.startsWith('v=spf1'));
  if (!spf) {
    fail(`SPF: no v=spf1 TXT record on ${domain}`);
  } else if (!/-all|~all/i.test(spf)) {
    fail(`SPF: present but missing terminal -all/~all → ${spf}`);
  } else {
    pass(`SPF: ${spf}`);
  }
} catch (err) {
  fail(`SPF: TXT lookup failed (${err.code ?? err.message})`);
}

// DKIM
for (const sel of selectors) {
  const host = `${sel}._domainkey.${domain}`;
  try {
    const cnames = await dns.resolveCname(host);
    if (cnames.length === 0) fail(`DKIM[${sel}]: no CNAME on ${host}`);
    else pass(`DKIM[${sel}]: → ${cnames[0]}`);
  } catch {
    // Some providers publish DKIM as TXT instead.
    try {
      const txt = (await dns.resolveTxt(host)).map((r) => r.join(''));
      const dk = txt.find((t) => t.includes('v=DKIM1') || t.includes('p='));
      if (dk) pass(`DKIM[${sel}] (TXT): ${dk.slice(0, 80)}…`);
      else fail(`DKIM[${sel}]: no CNAME or TXT on ${host}`);
    } catch (err) {
      fail(`DKIM[${sel}]: lookup failed on ${host} (${err.code ?? err.message})`);
    }
  }
}

// DMARC
try {
  const txt = (await dns.resolveTxt(`_dmarc.${domain}`)).map((r) => r.join(''));
  const dm = txt.find((t) => t.startsWith('v=DMARC1'));
  if (!dm) {
    fail(`DMARC: no v=DMARC1 TXT on _dmarc.${domain}`);
  } else {
    const policy = /\bp=(none|quarantine|reject)\b/i.exec(dm)?.[1];
    if (!policy) fail(`DMARC: present but no p= directive → ${dm}`);
    else if (policy === 'none')
      warn(`DMARC: p=none (monitor mode). Move to p=quarantine once aggregate reports look clean.`);
    else pass(`DMARC: p=${policy}`);
  }
} catch (err) {
  fail(`DMARC: lookup failed (${err.code ?? err.message})`);
}

if (!ok) {
  console.error(`\n✗ One or more required records are missing or malformed.`);
  console.error(`  See docs/email-deliverability.md for the canonical setup.`);
  process.exit(1);
} else {
  console.log(`\n✓ ${domain} passes basic deliverability checks.`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}
function warn(msg) {
  console.log(`  ! ${msg}`);
}
function fail(msg) {
  ok = false;
  console.log(`  ✗ ${msg}`);
}
