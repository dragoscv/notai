import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32),
    AUTH_TRUST_HOST: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
    AUTH_GOOGLE_ID: z.string().min(1),
    AUTH_GOOGLE_SECRET: z.string().min(1),
    HOCUSPOCUS_JWT_SECRET: z.string().min(32),
    // Optional transactional email — required in production for the
    // contact form to actually send. Missing in dev = log + succeed.
    RESEND_API_KEY: z.string().min(1).optional(),
    CONTACT_INBOX: z.string().email().optional(),
    CONTACT_FROM: z.string().min(1).optional(),
    // Optional rate-limit backend. If unset we fall back to in-memory.
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_HOCUSPOCUS_URL: z.string().url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_HOCUSPOCUS_URL: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
