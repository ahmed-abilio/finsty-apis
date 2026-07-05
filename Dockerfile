# syntax=docker/dockerfile:1.7
# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL deps (dev included) to compile TS. Cache mount keeps the npm
# download cache warm across builds so re-installs are near-instant.
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Compile to dist/
COPY tsconfig.json .swcrc ./
COPY src ./src
RUN npm run build

# Strip dev dependencies in place so we can reuse this node_modules in runtime
# (avoids a second full npm install). sequelize-cli is a prod dep, so it stays.
RUN npm prune --omit=dev

# ─── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Reuse the already-installed, pruned production node_modules from the builder
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules

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
