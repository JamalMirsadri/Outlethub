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
