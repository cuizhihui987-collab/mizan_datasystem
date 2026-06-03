# ─── Stage 1: Install & Build ─────────────────────────
FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./

# Copy all package.json files (for dependency resolution)
COPY apps/core/package.json ./apps/core/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-lib/package.json ./packages/shared-lib/
COPY packages/shared-ui/package.json ./packages/shared-ui/

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN cd packages/database && npx prisma generate

# Copy source code
COPY apps/core/ ./apps/core/
COPY packages/ ./packages/

# Build
RUN pnpm --filter @mizan/app-core build

# ─── Stage 2: Production ──────────────────────────────
FROM node:24-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ENV NODE_ENV=production

# Copy build artifacts
COPY --from=builder /app/apps/core/.next ./apps/core/.next
COPY --from=builder /app/apps/core/public ./apps/core/public
COPY --from=builder /app/apps/core/package.json ./apps/core/
COPY --from=builder /app/apps/core/next.config.ts ./apps/core/
COPY --from=builder /app/apps/core/.env ./apps/core/.env

# Copy node_modules (only production deps for core)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Prisma
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/database/node_modules/.prisma ./packages/database/node_modules/.prisma

# Entrypoint
COPY scripts/docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["pnpm", "--filter", "@mizan/app-core", "start"]
