import { pgTable, text, timestamp, integer, boolean, customType, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(v) {
    return Buffer.from(v);
  },
  fromDriver(v) {
    return new Uint8Array(v as Buffer);
  },
});

/**
 * WebAuthn / passkey credentials. One row per registered authenticator.
 * `credentialId` is the raw credential ID returned by the authenticator
 * (base64url-encoded for portability across clients). `publicKey` is the
 * COSE-encoded public key bytes from SimpleWebAuthn.
 */
export const webauthnCredentials = pgTable(
  'webauthn_credentials',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialId: text('credential_id').notNull().unique(),
    publicKey: bytea('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    /** comma-separated transports hint ('usb,nfc,ble,internal,hybrid'). */
    transports: text('transports'),
    /** 'singleDevice' | 'multiDevice'. */
    deviceType: text('device_type').notNull().default('singleDevice'),
    backedUp: boolean('backed_up').notNull().default(false),
    /** User-supplied label, e.g. "MacBook Touch ID". */
    label: text('label'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('webauthn_credentials_user_idx').on(t.userId)],
);

export type WebauthnCredential = typeof webauthnCredentials.$inferSelect;
