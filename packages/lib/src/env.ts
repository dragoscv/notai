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

    // Observability — every key is optional; missing keys disable that
    // integration cleanly so dev/CI never need any of them.
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),

    // Asset storage (S3-compatible: Cloudflare R2, GCS HMAC, …)
    ASSETS_PROVIDER: z.enum(['r2', 'gcs', 's3']).optional(),
    ASSETS_BUCKET: z.string().min(1).optional(),
    ASSETS_ENDPOINT: z.string().url().optional(),
    ASSETS_REGION: z.string().min(1).optional(),
    ASSETS_ACCESS_KEY_ID: z.string().min(1).optional(),
    ASSETS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    ASSETS_PUBLIC_BASE_URL: z.string().url().optional(),

    // OpenAI — drives RAG / Whisper / summarize. Missing = features hidden.
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
    OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
    OPENAI_WHISPER_MODEL: z.string().default('whisper-1'),

    // Stripe (server-side keys + price ids for the Pro tier)
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_PRICE_PRO_MONTHLY: z.string().min(1).optional(),
    STRIPE_PRICE_PRO_YEARLY: z.string().min(1).optional(),

    // Cron auth — a shared secret a scheduler (Vercel cron or other) sends.
    CRON_SECRET: z.string().min(16).optional(),

    // BullMQ queue backend (e.g. Upstash Redis: rediss://default:<token>@<host>:<port>).
    // Required when outbound webhooks are enabled — the dispatcher throws
    // if missing so producers can't silently drop deliveries.
    REDIS_URL: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_HOCUSPOCUS_URL: z.string().url(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_HOCUSPOCUS_URL: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
