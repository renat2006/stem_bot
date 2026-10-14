FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/art/package.json packages/art/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
RUN npm run build -w @stem/web && npm run build -w @stem/server

FROM gcr.io/distroless/nodejs22-debian12:nonroot
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    PORT=3001 \
    WEB_DIST_DIR=/app/web \
    MIGRATIONS_DIR=/app/drizzle \
    APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /app/apps/server/dist/ ./
COPY --from=build --chown=nonroot:nonroot /app/apps/web/dist/ ./web/
COPY --from=build --chown=nonroot:nonroot /app/apps/server/drizzle/ ./drizzle/
USER nonroot
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["--enable-source-maps", "index.mjs"]
