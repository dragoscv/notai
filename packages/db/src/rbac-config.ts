/**
 * Canonical permission keys + role mappings.
 *
 * Permissions are `resource:action` strings. The seed script upserts
 * everything in PERMISSIONS and links each role in ROLE_PERMISSIONS to
 * its allowed keys.
 *
 * To add a new permission:
 *   1. Add the key + description to `PERMISSIONS` below.
 *   2. Add it to whichever roles should have it in `ROLE_PERMISSIONS`.
 *   3. Re-run `pnpm db:seed:platform` (or the migrate script which calls it).
 */

export const PERMISSIONS = {
  // User management
  'users:read': 'View any user profile',
  'users:write': 'Edit user profile, name, status',
  'users:suspend': 'Suspend or unsuspend a user account',
  'users:delete': 'Delete a user account',
  'users:impersonate': 'Sign in as another user',
  'users:assign_roles': 'Grant or revoke roles on any user',

  // Billing & subscriptions
  'billing:read': 'View billing details for any user',
  'billing:write': 'Change a user subscription manually',
  'billing:refund': 'Issue a refund through Stripe',
  'billing:comp': 'Grant a complimentary plan to a user',

  // Plans & pricing (admin storefront)
  'plans:read': 'View plans and prices',
  'plans:write': 'Create, edit, archive plans and prices',

  // Notes (cross-tenant)
  'notes:read_any': 'View any user notes (support / abuse review)',
  'notes:delete_any': 'Delete any user note',

  // Platform
  'platform:analytics': 'View platform analytics dashboards',
  'platform:audit_log': 'View the audit log',
  'platform:feature_flags': 'Toggle feature flags',
  'platform:broadcasts': 'Create and send email broadcasts',
  'platform:health': 'View system health and operational metrics',
  'platform:coupons': 'Manage Stripe coupons',

  // Support tickets
  'support:read': 'View support tickets',
  'support:reply': 'Reply to support tickets',
  'support:manage': 'Assign, prioritize, and close support tickets',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLES = {
  super_admin: {
    description: 'Full platform access. Can do everything; cannot be deleted.',
    isSystem: true,
    /** Computed: super_admin always gets every permission. */
    permissions: Object.keys(PERMISSIONS) as PermissionKey[],
  },
  admin: {
    description: 'Day-to-day platform admin. No destructive billing or impersonation.',
    isSystem: true,
    permissions: [
      'users:read',
      'users:write',
      'users:suspend',
      'users:assign_roles',
      'billing:read',
      'billing:write',
      'billing:comp',
      'plans:read',
      'plans:write',
      'platform:analytics',
      'platform:audit_log',
      'platform:feature_flags',
      'platform:broadcasts',
      'platform:health',
      'platform:coupons',
      'support:read',
      'support:reply',
      'support:manage',
    ] satisfies PermissionKey[],
  },
  support: {
    description: 'Read-only support agent. Can view users and billing to help customers.',
    isSystem: true,
    permissions: [
      'users:read',
      'billing:read',
      'plans:read',
      'platform:audit_log',
      'platform:health',
      'support:read',
      'support:reply',
      'support:manage',
    ] satisfies PermissionKey[],
  },
  user: {
    description: 'Standard end-user. No admin permissions.',
    isSystem: true,
    permissions: [] satisfies PermissionKey[],
  },
} as const;

export type RoleName = keyof typeof ROLES;
