# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /workspace

# ---- deps + build ----
FROM base AS build
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend

RUN pnpm install --frozen-lockfile --filter @ringdog/frontend... \
  && pnpm --filter @ringdog/shared run build \
  && pnpm --filter @ringdog/frontend run build

# ---- runtime ----
# `output: "standalone"` (next.config.js) traces only the deps actually
# needed at runtime into .next/standalone, so the final image doesn't need
# the full node_modules tree or pnpm.
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/apps/frontend/.next/standalone ./
COPY --from=build /workspace/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /workspace/apps/frontend/public ./apps/frontend/public

# NEXT reads the PORT env var directly; set it to FRONTEND_PORT (3000) in
# docker/k8s, e.g. `-e PORT=3000` or `-p $FRONTEND_PORT:3000`.
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
