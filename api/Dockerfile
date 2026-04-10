# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN yarn build && ls dist/src/index.js
RUN mkdir -p dist/prisma && cp -r prisma/schema.prisma dist/prisma/ && \
    if [ -d prisma/migrations ]; then cp -r prisma/migrations dist/prisma/; fi

# --- Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma/generated ./prisma/generated

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api
USER api

EXPOSE 4000

CMD ["node", "dist/src/index.js"]
