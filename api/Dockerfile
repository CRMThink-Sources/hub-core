# syntax=docker/dockerfile:1
# API - multi-stage, Alpine para menor consumo de memória

# --- Stage 1: Builder ---
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json packages/db/prisma.config.ts ./packages/db/
COPY packages/db/prisma ./packages/db/prisma
COPY packages/bitrix/package.json packages/bitrix/src ./packages/bitrix/
COPY packages/ui/package.json packages/ui/src ./packages/ui/
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/api ./apps/api

# Gera Prisma Client e builda
ENV DATABASE_URL="file:./dev.db"
RUN pnpm --filter @repo/db run db:generate
RUN pnpm run build --filter=api

# Mantém tsx para rodar @repo/db (TS) em prod; ou compile packages/db
# RUN pnpm prune --prod

# --- Stage 2: Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

ENV NODE_ENV=production
EXPOSE 3000

# tsx permite @repo/db (index.ts) sem compilar; para só node, compile packages/db
CMD ["pnpm", "exec", "tsx", "apps/api/dist/index.js"]
