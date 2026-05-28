# Hubthink Admin Portal — Auth Implementation Plan

**Date:** 2026-05-28  
**Design:** [2026-05-28-hubthink-admin-portal-auth-design.md](../specs/2026-05-28-hubthink-admin-portal-auth-design.md)

---

## Phase 1: Database

1. Add `PortalUserRole` enum + `PortalUser` model to `api/prisma/schema.prisma`
2. Create migration `20260528120000_add_portal_users`
3. Add `bcryptjs` dependency
4. Create `api/src/scripts/create-portal-user.ts`
5. Document `PORTAL_BOOTSTRAP_EMAIL` / `PORTAL_BOOTSTRAP_PASSWORD` in `.env.example`

## Phase 2: Backend Module

1. Domain layer: entity, repository interface, errors
2. Application: hash/verify password, login use case, get session use case
3. Infra: Prisma repository, portal auth middleware
4. Presentation: login + session controllers
5. Factories + routes
6. Wire in `composition-root.ts` and `app.ts`
7. Extend `express.d.ts` with `portalUserId`, `portalUserRole`

## Phase 3: Tests

1. `verify-password.test.ts`
2. `login-portal-user.test.ts`

## Phase 4: Frontend

1. `axios-portal.ts` + `portal-session-provider.tsx`
2. Route group `(admin)` with layout, login page, home page
3. `admin-login-form.tsx`, `admin-shell.tsx`, `admin-theme.css`
4. i18n messages pt/en/es

## Phase 5: Verification

1. Run migration + create test user via script
2. Run backend tests
3. Manual smoke: login → /admin → logout
