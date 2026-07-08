# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
# Prisma's query engine needs the system libssl, which alpine doesn't ship
# by default (Node's own bundled OpenSSL doesn't satisfy this).
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /workspace

# ---- deps + build ----
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/chatbot-service ./apps/chatbot-service

RUN pnpm install --frozen-lockfile --filter @ringdog/chatbot-service... \
  && pnpm --filter @ringdog/db run generate \
  && pnpm --filter @ringdog/shared run build \
  && pnpm --filter @ringdog/db run build \
  && pnpm --filter @ringdog/chatbot-service run build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/apps/chatbot-service/dist ./dist
COPY --from=build /workspace/apps/chatbot-service/package.json ./package.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/shared ./packages/shared
COPY --from=build /workspace/packages/db ./packages/db

EXPOSE 4001
CMD ["node", "dist/server.js"]
