# Role User Table Migration Rollout

## Final schema
- `user_users` — customer accounts (canonical for domain FKs like addresses/orders)
- `admin_users` — admin accounts
- `vendor_users` — vendor accounts
- Legacy `users` table is dropped after migration

## Deployment order
1. Take a full database backup.
2. Deploy backend with role-table routing (`user.model.ts` -> `user_users`).
3. Run migrations: `npm run migrate`
   - Step 1: create role tables + copy from `users` by role (same IDs)
   - Step 2: rebind FKs from `users` -> `user_users` (no data truncation)
   - Step 3: drop legacy `users`
4. Validate:
   - `/auth/verify-otp`, `/auth/google`, `/auth/apple`
   - `/auth/admin/verify-otp`, `/auth/vendor/verify-otp`
   - `/users/me`, add address

## Migration command
- `npm run migrate`

## Rollback
1. Re-deploy previous backend.
2. `npm run migrate:undo` (recreates `users` from `user_users` on last migration down).
3. Restore DB backup if needed.

## Dev note
- Do not use `sequelize.sync({ alter: true })` during migration unless `ENABLE_DEV_SYNC=true`.
