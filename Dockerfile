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

# Prune dev dependencies
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

# Copy the Firebase service account JSON
COPY --chown=fastify:nodejs firebase-service-account.json ./

USER fastify

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/server.js"]
