# syntax=docker/dockerfile:1.9
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
WORKDIR /repo

# --- install full workspace deps (cacheable layer) ---
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY turbo.json tsconfig.base.json ./
COPY apps/realtime-server/package.json ./apps/realtime-server/
COPY packages/db/package.json ./packages/db/
COPY packages/lib/package.json ./packages/lib/
RUN pnpm install --frozen-lockfile --filter @notai/realtime-server...

# --- build + deploy (flattens workspace deps) ---
FROM deps AS build
COPY apps/realtime-server ./apps/realtime-server
COPY packages/db ./packages/db
COPY packages/lib ./packages/lib
RUN pnpm --filter @notai/realtime-server... build \
 && pnpm --filter=@notai/realtime-server --prod --legacy deploy /out

# --- runtime (only the deployed bundle) ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /out ./
USER app
EXPOSE 1234
CMD ["node", "dist/index.js"]
