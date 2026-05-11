import { describe, expect, it } from 'vitest';
import { hashNotePassword, verifyNotePassword } from './note-password';

describe('note-password', () => {
  it('hashes and verifies a correct password', () => {
    const stored = hashNotePassword('hunter2');
    expect(stored.startsWith('scrypt$16384$')).toBe(true);
    expect(verifyNotePassword(stored, 'hunter2')).toBe(true);
  });

  it('rejects a wrong password', () => {
    const stored = hashNotePassword('correct horse battery staple');
    expect(verifyNotePassword(stored, 'wrong')).toBe(false);
  });

  it('produces different hashes for the same password (salted)', () => {
    const a = hashNotePassword('same');
    const b = hashNotePassword('same');
    expect(a).not.toBe(b);
    expect(verifyNotePassword(a, 'same')).toBe(true);
    expect(verifyNotePassword(b, 'same')).toBe(true);
  });

  it('rejects malformed hashes without throwing', () => {
    expect(verifyNotePassword('', 'x')).toBe(false);
    expect(verifyNotePassword('not-scrypt$1$a$b', 'x')).toBe(false);
    expect(verifyNotePassword('scrypt$nan$abcd$ef01', 'x')).toBe(false);
    expect(verifyNotePassword('scrypt$16384$$', 'x')).toBe(false);
    expect(verifyNotePassword('scrypt$16384$abcd', 'x')).toBe(false);
  });

  it('handles unicode passwords consistently', () => {
    const stored = hashNotePassword('pässwörd 日本語 🔐');
    expect(verifyNotePassword(stored, 'pässwörd 日本語 🔐')).toBe(true);
    expect(verifyNotePassword(stored, 'passwörd 日本語 🔐')).toBe(false);
  });
});
