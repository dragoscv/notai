# Optional alternative deploy target. Vercel is the primary host (see ../../.github/workflows/release-web.yml).
# This Dockerfile lets you self-host on Cloud Run / Fly.io / Railway / etc.
# It builds a standalone Next.js output for minimal runtime.
# syntax=docker/dockerfile:1.9
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
WORKDIR /app

# --- install deps (pruned) ---
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY turbo.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/editor/package.json ./packages/editor/
COPY packages/lib/package.json ./packages/lib/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile --filter @notai/web...

# --- build ---
FROM deps AS build
COPY apps/web ./apps/web
COPY packages ./packages
ENV NEXT_TELEMETRY_DISABLED=1
# Build args expose env at build time (mostly used by Next for static analysis)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_HOCUSPOCUS_URL
RUN pnpm --filter @notai/web... build

# --- runtime (lean) ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/apps/web/.next ./apps/web/.next
COPY --from=build --chown=app:app /app/apps/web/public ./apps/web/public
COPY --from=build --chown=app:app /app/apps/web/package.json ./apps/web/package.json
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/packages ./packages
USER app
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
