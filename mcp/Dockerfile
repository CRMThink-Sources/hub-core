# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN yarn build && ls dist/index.js

# --- Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=builder /app/dist ./dist

# KB é lido em runtime a partir de dist/../kb (src/kb.ts) — precisa viajar na imagem
COPY kb ./kb

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mcp
USER mcp

EXPOSE 3200

CMD ["node", "dist/index.js"]
