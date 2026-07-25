# Luxe Outlet Hub

Independent full-stack marketplace built with:

- `client/`: Vite + React + React Router + TypeScript
- `server/`: Express + TypeScript + Prisma
- `database`: PostgreSQL
- `auth`: JWT access tokens + refresh token rotation
- `infra`: Redis + BullMQ + Cloudinary + Stripe scaffolding

## Workspace Scripts

- `npm run dev:client`
- `npm run dev:server`
- `npm run build`
- `npm run typecheck`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:seed`

## Setup

1. Install dependencies with `npm install`
2. Copy `.env.example` into your local environment file strategy
3. Set PostgreSQL, JWT, Redis, Cloudinary, and Stripe credentials
4. Generate Prisma client with `npm run prisma:generate`
5. Run migrations with `npm run prisma:migrate`
6. Seed default roles with `npm run prisma:seed`

## Current Status

- Sprint 1 foundation is in place for `User`, `Role`, auth, JWT, and refresh tokens.
- Existing UI layouts remain intact while backend/data plumbing is being migrated domain by domain.
- Remaining storefront/admin data modules still use a temporary internal client facade until their REST APIs are implemented.

## Render Deployment

### Runtime Behavior

- Production startup uses `process.env` only.
- `.env` files are for local development and are not required in production.
- Root start command runs the server workspace: `npm run start` -> `npm run start --workspace server`.
- Render web service should run in `SERVICE_MODE=web`.
- Render worker service should run in `SERVICE_MODE=worker`.

### Required Environment Variables

Set these on the Render `outlethub-api` service:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CLIENT_URL`
- `REDIS_URL`

Important for existing manual Render services:

- `render.yaml` does not retroactively inject env vars into an already-created manual service.
- If `outlethub-api` already exists in Render, you must open `Environment` in the Render dashboard and add the required variables there.
- `outlethub-workers` can inherit the JWT and database values from `outlethub-api` only after they exist on `outlethub-api`.

These are recommended for full functionality:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Render Commands

- Build: `npm install && npm run build`
- Pre-deploy: `npm run prepare:runtime`
- Start: `npm run start`
- Health check: `/api/v1/health`

### Manual Render Setup

If you created the Render services manually instead of creating them from the repo Blueprint:

1. Open `outlethub-api` in Render.
2. Set `Build Command` to `npm install && npm run build`.
3. Set `Start Command` to `npm run start`.
4. Go to `Environment`.
5. Add these values:
   - `DATABASE_URL` = your Render internal Postgres URL
   - `JWT_ACCESS_SECRET` = random secret, at least 32 characters
   - `JWT_REFRESH_SECRET` = different random secret, at least 32 characters
   - `CLIENT_URL` = your frontend URL
   - `REDIS_URL` = your Render Redis/Key Value connection string
6. Save changes.
7. Redeploy `outlethub-api`.
8. After `outlethub-api` is correct, redeploy `outlethub-workers`.

### Failure Mode

- If required variables are missing, startup fails fast with a names-only error such as:
  - `Missing required environment variables: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET`
- Secret values are never logged by startup diagnostics.
