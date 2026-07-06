# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /workspace

# ---- deps + build ----
FROM base AS build
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/chatbot-service ./apps/chatbot-service

RUN pnpm install --frozen-lockfile --filter @ringdog/chatbot-service... \
  && pnpm --filter @ringdog/db run generate \
  && pnpm --filter @ringdog/shared run build \
  && pnpm --filter @ringdog/db run build \
  && pnpm --filter @ringdog/chatbot-service run build

# ---- runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/apps/chatbot-service/dist ./dist
COPY --from=build /workspace/apps/chatbot-service/package.json ./package.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/shared ./packages/shared
COPY --from=build /workspace/packages/db ./packages/db

EXPOSE 4001
CMD ["node", "dist/server.js"]
