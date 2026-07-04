# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install all deps (including dev) needed to compile TypeScript with swc + tsc-alias
COPY package*.json ./
RUN npm ci

# Copy source and build config, then compile to dist/
COPY tsconfig.json .swcrc ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# Only production dependencies (sequelize-cli is a runtime dep, so migrations work)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled application
COPY --from=builder /app/dist ./dist

# Files needed for `sequelize-cli db:migrate` at container start
COPY .sequelizerc ./
COPY migrations ./migrations
COPY src/config/sequelize-cli.js ./src/config/sequelize-cli.js

# Startup script (runs migrations, then boots the server)
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
