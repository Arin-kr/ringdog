# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /workspace

# ---- deps + build ----
FROM base AS build
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/backend-api ./apps/backend-api

RUN pnpm install --frozen-lockfile --filter @ringdog/backend-api... \
  && pnpm --filter @ringdog/db run generate \
  && pnpm --filter @ringdog/shared run build \
  && pnpm --filter @ringdog/db run build \
  && pnpm --filter @ringdog/backend-api run build

# ---- runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/apps/backend-api/dist ./dist
COPY --from=build /workspace/apps/backend-api/package.json ./package.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/shared ./packages/shared
COPY --from=build /workspace/packages/db ./packages/db

EXPOSE 4000
CMD ["node", "dist/server.js"]
