# syntax=docker/dockerfile:1
# Auth (Next.js) - multi-stage, standalone output para menor imagem

# --- Stage 1: Builder ---
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/auth/package.json ./apps/auth/
COPY packages/bitrix/package.json ./packages/bitrix/
COPY packages/ui/package.json ./packages/ui/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

# Build Next.js (output standalone = sem node_modules completo)
RUN pnpm run build --filter=auth

# --- Stage 2: Runtime ---
FROM node:20-alpine AS runner

ENV NODE_ENV=production

# Usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

WORKDIR /app

# Copia output standalone (auto-contido, ~50MB vs ~500MB)
COPY --from=builder /app/apps/auth/.next/standalone ./
COPY --from=builder /app/apps/auth/.next/static ./apps/auth/.next/static
COPY --from=builder /app/apps/auth/public ./apps/auth/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/auth/server.js"]
