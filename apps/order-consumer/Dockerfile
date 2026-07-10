# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
# Prisma's query engine needs the system libssl, which alpine doesn't ship
# by default (Node's own bundled OpenSSL doesn't satisfy this). ca-certificates
# is needed too, or the engine download from binaries.prisma.sh fails TLS
# verification with "unable to get local issuer certificate".
RUN apk add --no-cache openssl ca-certificates
RUN corepack enable
WORKDIR /workspace

# ---- deps + build ----
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/order-consumer ./apps/order-consumer

# --shamefully-hoist: the runtime stage below only copies the *root*
# node_modules, not apps/order-consumer/node_modules — without hoisting, a
# real npm dep like dd-trace only gets symlinked into the latter and is
# unresolvable from dist/index.js at runtime.
RUN pnpm install --frozen-lockfile --shamefully-hoist --filter @ringdog/order-consumer... \
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
