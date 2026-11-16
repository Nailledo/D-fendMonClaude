# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile
COPY packages packages
RUN pnpm build

# ---- exécution ----
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 STATIC_DIR=/app/public DB_PATH=/data/scores.db
WORKDIR /app
COPY --from=build /app/packages/server/dist ./
COPY --from=build /app/packages/client/dist ./public
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "--no-warnings=ExperimentalWarning", "server.js"]
