# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server with hot reload (ts-node + nodemon)
npm run build        # Compile TypeScript to dist/ (tsc + tsc-alias for path resolution)
npm run start        # Run compiled production server
npm run lint         # Check code with ESLint
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format with Prettier
npm run migrate      # Run pending Sequelize migrations
npm run migrate:undo # Rollback last migration
npm run migrate:create -- --name <migration-name>  # Generate new migration file
```

No test runner is configured yet.

**Docker:**
```bash
docker-compose up                        # Start app + postgres + redis
docker-compose --profile dev up          # Also starts pgAdmin on :5050
```

## Architecture

**Fastify 4** REST API with a feature-based modular structure. TypeScript strict mode throughout with path aliases (`@modules/*`, `@config/*`, `@utils/*`, `@middlewares/*`, `@queues/*`, `@plugins/*`, `@types-app/*`).

### Startup flow

`src/server.ts` connects to PostgreSQL and Redis, then calls `buildApp()` from `src/app.ts`. `app.ts` registers all plugins (security, swagger, multipart), decorates the Fastify instance, mounts routes under `/api/v1`, and registers the global error handler.

### Module structure

Each domain module under `src/modules/<name>/` has four files: `model.ts` (Sequelize), `service.ts` (business logic), `controller.ts` (HTTP handlers), `routes.ts` (route registration with Fastify schemas), and `schema.ts` (AJV/OpenAPI schemas). Routes are registered in `app.ts`.

### Authentication

`src/middlewares/authenticate.ts` decorates Fastify with `fastify.authenticate` (JWT verification) and `fastify.requireRole(...roles)`. Three auth flows in `auth.service.ts`: phone OTP (stored in Redis with 5-min TTL), Google Firebase token, Apple Firebase token. Access tokens are 15-minute JWTs; refresh tokens are UUIDs stored in Redis.

> **Note:** OTP is currently hardcoded to `'1234'` — a real SMS provider (Twilio/Termii) needs to be integrated.

### Error handling

`src/utils/appError.ts` defines `AppError` with static factories (`.badRequest()`, `.unauthorized()`, `.notFound()`, etc.) that carry a `code` string (e.g., `"INVALID_OTP"`). The global formatter in `src/utils/errorFormatter.ts` normalizes AJV validation errors, Firebase errors, and `AppError` into `{ success: false, error: { code, message, details? } }`.

### Job queues

BullMQ queue defined in `src/queues/emailQueue.ts` with a worker in `src/queues/emailWorker.ts` (worker logic not yet implemented). Bull Board admin UI is mounted at `/admin/queues` and protected by the `x-admin-api-key` header matching `ADMIN_API_KEY` env var.

### Key singletons

| File | Purpose |
|------|---------|
| `src/config/database.ts` | Sequelize instance (pool: min 2, max 10) |
| `src/config/redis.ts` | ioredis singleton + BullMQ connection factory |
| `src/config/firebase.ts` | Firebase Admin SDK init |
| `src/config/s3.ts` | AWS S3 client |
| `src/utils/logger.ts` | Pino (pretty in dev, JSON in prod) |

### API surface

- `POST /api/v1/auth/send-otp` — send OTP to phone
- `POST /api/v1/auth/verify-otp` — verify OTP, returns JWT pair
- `POST /api/v1/auth/google` — Firebase Google token exchange
- `POST /api/v1/auth/apple` — Firebase Apple token exchange
- `POST /api/v1/auth/refresh` — refresh access token
- `POST /api/v1/auth/logout` — revoke refresh token (requires JWT)
- `GET/PATCH/DELETE /api/v1/users/me` — profile management (requires JWT)
- `GET /api/v1/users/presigned-upload` — S3 presigned upload URL (requires JWT)
- `GET /health` — liveness probe
- `GET /docs` — Swagger UI

### Database

PostgreSQL via Sequelize ORM. Migrations live in `/migrations/`. Models auto-sync in dev; use `npm run migrate` in production. The only current model is `User` with fields: `id` (UUID PK), `firebase_uid`, `phone`, `email`, `provider` (enum), `role` (enum: user/admin/vendor), `is_active`.

### Environment

Copy `.env.example` to `.env`. Required groups: app (`PORT`, `HOST`, `API_PREFIX`), JWT secrets, PostgreSQL connection, Redis connection, Firebase (`FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON`), AWS S3, and `ADMIN_API_KEY` for the queue admin UI.
