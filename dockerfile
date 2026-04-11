# build project with pnpm installed
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

#build dependency
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# copy all and build project
FROM base AS build
COPY . .
COPY --from=deps /app/node_modules ./node_modules
# Generate migrations from schema before building
RUN pnpm run build

FROM node:20-slim AS deploy
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/drizzle ./drizzle
# copy src/datbase/schema
COPY --chown=node:node --from=build /app/src/database/schema.ts ./src/database/schema.ts
COPY --chown=node:node --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --chown=node:node --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh
USER node

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]

CMD ["node", "dist/main.js"]