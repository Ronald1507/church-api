# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

REST API for a multi-congregation church management system. Express 5 + TypeScript, Prisma 7 ORM over PostgreSQL. All domain language (models, routes, response messages) is in Spanish; keep new code consistent with that.

## Commands

```bash
npm run dev      # Run with ts-node (src/index.ts), no build step
npm run build    # Compile TypeScript to dist/ (tsc)
npm start        # Run compiled output (node dist/index.js)

npx prisma generate      # Regenerate Prisma client after editing schema.prisma
npx prisma db push       # Push schema changes to the database (no migrations dir is used)
npx ts-node prisma/seed.ts   # Seed RBAC roles, permisos, and base data
```

There is **no test runner** (`npm test` is a placeholder) and no linter configured.

`dist/` is committed to the repo, so rebuilding produces tracked diffs. Requires a `.env` with `DATABASE_URL` (PostgreSQL), `JWT_SECRET`, `JWT_REFRESH_SECRET`, and optionally `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` / `PORT`.

## Architecture

Entry point `src/index.ts` wires CORS + JSON middleware and mounts one router per domain under `/api/*` (auth, miembros, congregaciones, eventos, finanzas, usuarios, inventario, instituciones, estados). Each `src/routes/*.ts` file is a self-contained Express router holding its own CRUD handlers and inline Prisma queries — there is no service/repository layer.

Four cross-cutting conventions tie the routes together. Understand these before changing any route:

### 1. Centralized dynamic state system (`Estado` table)
There is a single `estado` table keyed by `(entidad, codigo)` — e.g. `('MIEMBRO', 'ACTIVO')`, `('EVENTO', 'CANCELADO')`. Every domain model references it via `id_estado`. **Never hardcode `id_estado` integers.** Resolve them at runtime with the helpers in `src/utils/estados.ts` (`getEstadoByCodigo`, `getEstadoId`). Deletes are soft: set the row's state to the entity's `ELIMINADO` estado rather than deleting (see `miembros.ts` DELETE handler). The `EntidadEstado` union in `estados.ts` is the source of truth for valid entity names.

### 2. Three-tier access + RBAC (`src/middleware/`)
Auth is a `NivelAcceso` enum: `USUARIO` < `ADMIN` < `SUPERADMIN` (stored on `UsuarioSistema.nivel`). `authenticateToken` (auth.ts) verifies the JWT and populates `req.user` (typed via the `AuthRequest` interface). `requirePermission(recurso, accion)` (permissions.ts) gates handlers: **ADMIN and SUPERADMIN bypass all permission checks**; only `USUARIO`-level accounts are checked against the `rol_permiso` → `permiso` join (`recurso` + `accion`, where `accion: 'admin'` grants all actions on a resource). The standard handler signature is `(authenticateToken, requirePermission('<recurso>', '<accion>'), handler)`.

### 3. Congregation multi-tenancy
Most data is scoped to a `congregacion`. Non-admin users only see their own `id_congregacion`; ADMIN/SUPERADMIN see all. Apply this by spreading `getCongregacionFilter(req.user)` (auth.ts) into every Prisma `where` clause — it returns `{}` for admins, `{ id_congregacion }` for users, and `{ id_congregacion: -1 }` (matches nothing) for users with no congregation. On create/update, non-admins must not be able to set `id_congregacion` to another congregation (routes strip or override it; see `miembros.ts`).

### 4. Standardized API responses (`src/utils/response.ts`)
All handlers return through the `ApiResponse` helper + `sendResponse(res, ...)`, producing `{ success, mensaje, data, error }` with the status code carried on the response object. Use the semantic constructors: `ApiResponse.success/created/updated/deleted/error/validationError/notFound/unauthorized/forbidden`. Do not write raw `res.json(...)` in route handlers.

### Prisma client
`src/config/db.ts` exports a singleton `prisma` client built on the `@prisma/adapter-pg` driver adapter over a `pg` Pool (not Prisma's default engine). It is cached on `globalThis` outside production to survive `ts-node` reloads. Import the default export everywhere; do not instantiate `PrismaClient` directly (the seed scripts are the exception).

### Schema notes (`prisma/schema.prisma`)
Models use Spanish snake_case columns via `@map`, with `@@map` table names. The schema is large (~12 modules: sistema/RBAC, membresía, familia, espiritual, pastoral, instituciones, eventos, economía, inventario, comunicaciones, auditoría). A few FKs are intentionally nullable for in-progress migrations (`Transaccion.id_tipo`, `id_metodo_pago`; `FinanzaCuenta.id_institucion` distinguishes congregation vs. institution accounts). After any schema edit, run `prisma generate` and `prisma db push`.
