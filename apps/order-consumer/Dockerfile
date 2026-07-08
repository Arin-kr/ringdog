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
COPY apps/order-consumer ./apps/order-consumer

RUN pnpm install --frozen-lockfile --filter @ringdog/order-consumer... \
  && pnpm --filter @ringdog/db run generate \
  && pnpm --filter @ringdog/shared run build \
  && pnpm --filter @ringdog/db run build \
  && pnpm --filter @ringdog/order-consumer run build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/apps/order-consumer/dist ./dist
COPY --from=build /workspace/apps/order-consumer/package.json ./package.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/shared ./packages/shared
COPY --from=build /workspace/packages/db ./packages/db

# No inbound traffic besides the k8s health probe.
EXPOSE 4002
CMD ["node", "dist/index.js"]
