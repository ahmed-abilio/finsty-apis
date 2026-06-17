# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --include=dev

# Copy source and compile
COPY tsconfig.json .
COPY src ./src
RUN npm run build

# Prune dev dependencies (sequelize-cli stays — production dependency)
RUN npm ci --omit=dev && npm cache clean --force

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S fastify -u 1001

# Copy only what is needed
COPY --from=builder --chown=fastify:nodejs /app/dist ./dist
COPY --from=builder --chown=fastify:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=fastify:nodejs /app/package.json ./package.json
COPY --from=builder --chown=fastify:nodejs /app/migrations ./migrations
COPY --chown=fastify:nodejs .sequelizerc ./
COPY --chown=fastify:nodejs src/config/sequelize-cli.js ./src/config/sequelize-cli.js
COPY --chown=fastify:nodejs scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# Copy the Firebase service account JSON at runtime via docker-compose volume mount.
# Do not bake credentials into the image.

RUN chmod +x ./scripts/docker-entrypoint.sh

USER fastify

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
