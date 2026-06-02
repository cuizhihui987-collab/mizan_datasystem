# ─── Stage 1: Build ──────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

# Install dependencies (separate layer for caching)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Generate Prisma client
COPY prisma/schema.prisma ./prisma/
RUN npx prisma generate

COPY scripts/docker-entrypoint.sh ./scripts/
COPY . .
RUN npm run build

# ─── Stage 2: Production ─────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy build artifacts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/.env.production ./.env
COPY --from=builder /app/.env.production ./.env.production

# Include the dev database for migration (will be copied to volume on first run)
COPY --from=builder /app/prisma/dev.db /app/seed.db

# Copy scripts (entrypoint + SQL migrations)
COPY --from=builder /app/scripts/docker-entrypoint.sh /app/entrypoint.sh
COPY --from=builder /app/scripts/create-dashboard-tables.sql /app/scripts/create-dashboard-tables.sql
COPY --from=builder /app/scripts/create-pipeline-tables.sql /app/scripts/create-pipeline-tables.sql
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "node_modules/.bin/next", "start"]
