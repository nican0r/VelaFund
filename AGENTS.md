# AGENTS.md - Operational Reference

## Monorepo Structure

```
navia-mvp/
  backend/     → @navia/backend  (NestJS + Prisma)
  frontend/    → @navia/frontend (Next.js 14)
  contracts/   → Foundry smart contracts (scaffold only)
```

## Commands

### Root (monorepo)

```bash
pnpm install                       # Install all workspace dependencies
pnpm dev                           # Start all workspaces in dev mode (via Turborepo)
pnpm build                         # Build all workspaces (via Turborepo)
pnpm test                          # Run all workspace tests (via Turborepo)
pnpm lint                          # Lint all workspaces
pnpm type-check                    # Type-check all workspaces
pnpm format                        # Format all files with Prettier
pnpm format:check                  # Check formatting without writing
```

### Backend (@navia/backend)

```bash
cd backend
pnpm dev                           # Start NestJS in watch mode
pnpm build                         # Build NestJS to dist/
pnpm test                          # Run unit tests (Jest)
pnpm test:cov                      # Run unit tests with coverage
pnpm test:e2e                      # Run E2E tests
pnpm type-check                    # TypeScript type-check
pnpm lint                          # ESLint
pnpm prisma:generate               # Generate Prisma client from schema
pnpm prisma:migrate:dev            # Create and apply dev migration
pnpm prisma:migrate:deploy         # Apply migrations in production
pnpm prisma:studio                 # Open Prisma Studio GUI
```

### Frontend (@navia/frontend)

```bash
cd frontend
pnpm dev                           # Start Next.js dev server on port 3000
pnpm build                         # Production build
pnpm test                          # Run Jest tests
pnpm test:cov                      # Run tests with coverage
pnpm type-check                    # TypeScript type-check
pnpm lint                          # Next.js ESLint
```

### Filtering from root

```bash
pnpm --filter @navia/backend test          # Run only backend tests
pnpm --filter @navia/frontend build        # Build only frontend
pnpm --filter @navia/backend prisma:generate
```

## Environment Variables

- Backend: `backend/.env` (copy from `backend/.env.example`)
- Frontend: `frontend/.env.local` (copy from `frontend/.env.example`)

## Key Files

| File | Purpose |
|------|---------|
| `backend/prisma/schema.prisma` | Database schema (all entities) |
| `backend/src/main.ts` | NestJS bootstrap (middleware, pipes, filters) |
| `backend/src/auth/auth.service.ts` | Privy auth: token verify, login, user find/create |
| `backend/src/auth/auth.controller.ts` | Auth endpoints: login, logout, me |
| `backend/src/auth/guards/auth.guard.ts` | Global auth guard (JWT + cookie extraction) |
| `backend/src/common/filters/global-exception.filter.ts` | Error response formatting |
| `backend/src/common/interceptors/response.interceptor.ts` | Success response envelope |
| `frontend/src/app/globals.css` | shadcn/ui CSS variables (Navia theme) |
| `frontend/tailwind.config.ts` | Design system tokens |
| `frontend/messages/pt-BR.json` | Portuguese translations |
| `frontend/messages/en.json` | English translations |

## Git Tags

- Tags follow semver: `0.0.x` for MVP phases
- Create with: `git tag -a v0.0.X -m "description"`
- Push with: `git push origin v0.0.X`
