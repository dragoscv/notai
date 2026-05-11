function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Cheap passphrase strength heuristic. We deliberately do NOT pull in
 * zxcvbn — its dictionary alone is ~700 KB and would dominate the
 * Settings bundle. The heuristic below is a reasonable proxy for
 * E2E setup ergonomics: encourage long phrases with multiple
 * character classes and penalise obvious weakness patterns. Returns
 * a 0–4 score and a short tip the UI can show inline.
 */
export interface PassphraseStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'too weak' | 'weak' | 'okay' | 'strong' | 'very strong';
  tip: string;
}

const COMMON = new Set([
  'password',
  'passphrase',
  'qwerty',
  'letmein',
  'iloveyou',
  '123456',
  '12345678',
  '123456789',
  'welcome',
  'admin',
  'monkey',
  'dragon',
]);

export function assessPassphrase(input: string): PassphraseStrength {
  const value = input.trim();
  if (value.length === 0) {
    return { score: 0, label: 'too weak', tip: 'Enter a passphrase.' };
  }

  const lower = value.toLowerCase();
  if (COMMON.has(lower)) {
    return { score: 0, label: 'too weak', tip: 'That is one of the most common passwords.' };
  }

  const len = value.length;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  const uniqueChars = new Set(value).size;
  const hasRepeats = /(.)\1{2,}/.test(value);
  const hasSequence = /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/i.test(
    value,
  );

  // Base score from length, then bonuses / penalties.
  let raw = 0;
  if (len >= 8) raw += 1;
  if (len >= 12) raw += 1;
  if (len >= 16) raw += 1;
  if (len >= 24) raw += 1;
  if (classes >= 3) raw += 1;
  if (uniqueChars >= 10) raw += 1;
  if (hasRepeats) raw -= 1;
  if (hasSequence) raw -= 1;

  const score = Math.max(0, Math.min(4, raw - 1)) as PassphraseStrength['score'];

  let label: PassphraseStrength['label'];
  let tip: string;
  switch (score) {
    case 0:
      label = 'too weak';
      tip = 'Use at least 12 characters and mix word, number, and symbol.';
      break;
    case 1:
      label = 'weak';
      tip = 'Make it longer — 16+ characters is much harder to crack.';
      break;
    case 2:
      label = 'okay';
      tip = 'Decent. A four-word phrase would push this to strong.';
      break;
    case 3:
      label = 'strong';
      tip = 'Strong. Keep it stored somewhere you trust.';
      break;
    case 4:
      label = 'very strong';
      tip = 'Excellent. This is well beyond brute-force range.';
      break;
  }
  return { score, label, tip };
}

/**
 * Check a passphrase against Have I Been Pwned's k-anonymity API.
 * Only the first 5 hex chars of SHA-1 are sent, so the full
 * passphrase never leaves the browser. Returns the appearance count
 * (0 if not breached) or null if the call fails (we treat network
 * errors as "skip the check" rather than blocking setup).
 */
export async function checkPassphraseBreached(passphrase: string): Promise<number | null> {
  try {
    const enc = new TextEncoder().encode(passphrase);
    const hashBuf = await crypto.subtle.digest('SHA-1', enc);
    const fullHash = toHex(new Uint8Array(hashBuf)).toUpperCase();
    const prefix = fullHash.slice(0, 5);
    const suffix = fullHash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return null;
    const body = await res.text();

    for (const line of body.split('\n')) {
      const [hashSuffix, count] = line.trim().split(':');
      if (hashSuffix === suffix) {
        return Number.parseInt(count ?? '0', 10) || 0;
      }
    }
    return 0;
  } catch {
    return null;
  }
}
