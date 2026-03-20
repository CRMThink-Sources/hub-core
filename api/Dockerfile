# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate --schema=src/prisma/schema.prisma
RUN yarn build
RUN mkdir -p dist/prisma && cp -r src/prisma/schema.prisma src/prisma/migrations dist/prisma/

# --- Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=builder /app/dist ./dist

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api
USER api

EXPOSE 4000

CMD ["node", "dist/index.js"]
