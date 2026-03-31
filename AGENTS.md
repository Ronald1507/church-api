# AGENTS.md - Church API (Backend)

This document provides guidelines for AI agents working on the backend codebase.

## Project Overview

- **Type**: REST API Backend
- **Stack**: TypeScript, Express, Prisma, PostgreSQL
- **Port**: 3000 (default)

---

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development (hot reload with ts-node)
npm run dev

# Build TypeScript to dist/
npm run build

# Start production server
npm run start
```

### Running Tests

No test framework is configured. To add tests:

```bash
npm install --save-dev jest ts-jest @types/jest
```

Then configure Jest and run:

```bash
npx jest --testPathPattern=src/routes/miembros.test.ts
```

---

## Code Style Guidelines

### General Conventions

- **Language**: Spanish for comments, error messages, user-facing text
- **Code**: English for variable/function names (camelCase)
- **TypeScript strict mode**: Enabled in `tsconfig.json`

### Import Order

```typescript
// 1. Node built-ins
import path from 'path';

// 2. External libraries
import express, { Application, Request, Response } from 'express';
import cors from 'cors';

// 3. Internal modules (use relative paths)
import prisma from './config/db';
import authRoutes from './routes/auth';
```

### TypeScript Guidelines

- **Always use explicit types** for function parameters and return types
- **Use interfaces** for request/response objects
- **Enable strict mode** - no implicit any

```typescript
// Good
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const miembros = await prisma.miembro.findMany();
    res.json(miembros);
  } catch (error) {
    console.error('Get miembros error:', error);
    res.status(500).json({ error: 'Error al obtener miembros' });
  }
});

// Avoid
router.get('/', async (req, res) => {
  const miembros = await prisma.miembro.findMany();
  res.json(miembros);
});
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `memberId`, `fetchMembers` |
| Functions | camelCase | `getMemberById()` |
| Database models | PascalCase (Prisma) | `Miembro`, `Ministerio` |
| API endpoints | kebab-case | `/api/miembros` |
| Files | kebab-case | `auth-routes.ts`, `auth-middleware.ts` |

---

## Error Handling

```typescript
// Always use try-catch in route handlers
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const memberId = getId(req);
    if (memberId === null) {
      return res.status(400).json({ error: 'ID de miembro inválido' });
    }
    
    const miembro = await prisma.miembro.findUnique({
      where: { id_miembro: memberId }
    });

    if (!miembro) {
      return res.status(404).json({ error: 'Miembro no encontrado' });
    }

    res.json(miembro);
  } catch (error) {
    console.error('Get miembro error:', error);
    res.status(500).json({ error: 'Error al obtener miembro' });
  }
});
```

---

## Database (Prisma)

- **PascalCase** for model names: `Miembro`, `Ministerio`
- **camelCase** for fields: `fechaNacimiento`, `idMinisterio`
- Include related data with `include: {}`

```typescript
const miembro = await prisma.miembro.findUnique({
  where: { id_miembro: memberId },
  include: {
    congregacion: true,
    ministerios: true,
  },
});
```

---

## API Design

- **RESTful endpoints** with proper HTTP methods:
  - `GET /resource` - List all
  - `GET /resource/:id` - Get one
  - `POST /resource` - Create
  - `PUT /resource/:id` - Update
  - `DELETE /resource/:id` - Delete

- **Response format**:
  - Success: direct object or `{ data: ... }`
  - Error: `{ error: 'Mensaje en español' }`
  - Status codes: 200, 201, 400, 401, 404, 500

---

## Authentication

- JWT tokens in Authorization header: `Authorization: Bearer <token>`
- Validate via middleware and attach user to request

```typescript
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
};
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript config (strict: true) |
| `package.json` | Dependencies and scripts |
| `prisma.config.ts` | Prisma configuration |

---

## Environment Variables

Create `.env` in project root:

```
DATABASE_URL="postgresql://user:password@localhost:5432/iglesia"
JWT_SECRET="your-secret-key"
PORT=3000
```

---

## Adding a New Route

1. Create route file in `src/routes/` (e.g., `nuevoruta.ts`)
2. Define router with CRUD operations
3. Import and mount in `src/index.ts`:

```typescript
import nuevaRuta from './routes/nuevoruta';
app.use('/api/nuevaruta', nuevaRuta);
```

---

## Recommendations

1. **Add testing**: Install Jest with `ts-jest`
2. **Add API validation**: Use Zod or Joi
3. **Add logging**: Use Winston or Pino
4. **Add CI/CD**: GitHub Actions for automated builds
