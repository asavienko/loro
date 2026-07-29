# Multi-stage build. Distroless, non-root, read-only filesystem at runtime.
# See docs/architecture/security-privacy.md#server-hardening

# ── deps ──
FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY packages/content/package.json packages/content/
COPY packages/core-rs/package.json packages/core-rs/
RUN pnpm install --frozen-lockfile --filter @loro/api...

# ── build ──
FROM deps AS build
WORKDIR /repo
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY packages/content packages/content
COPY apps/api apps/api
# The WASM build of loro-core: the server runs the SAME merge as the client.
# Built in CI and copied in, so this image needs no Rust toolchain.
COPY packages/core-rs/pkg packages/core-rs/pkg
RUN pnpm --filter @loro/api build
RUN pnpm --filter @loro/api deploy --prod /out

# ── runtime ──
FROM gcr.io/distroless/nodejs22-debian12 AS runtime
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /out ./
USER nonroot
EXPOSE 3000
ENV NODE_ENV=production
# Liveness is /health; readiness (/health/ready) gates the blue-green cutover.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3000/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["dist/main.js"]
