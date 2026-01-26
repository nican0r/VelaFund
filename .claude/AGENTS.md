# Agent Commands Guide

## Project Structure

- **Frontend**: Next.js 14+ TypeScript (`/frontend`)
- **Backend**: NestJS TypeScript (`/backend`)
- **Smart Contracts**: Solidity (`/contracts`)

## Build & Run

### Frontend (Next.js)
```bash
cd frontend && npm run build
cd frontend && npm run dev  # Development server on port 3000
```

### Backend (NestJS)
```bash
cd backend && npm run build
cd backend && npm run start:dev  # Development server on port 3001
```

### Smart Contracts
```bash
cd contracts && npx hardhat compile
```

## Validation

Run these after implementing to get immediate feedback:

### Frontend
- **Tests**: `cd frontend && npm test`
  - File: `npm test -- <file-path>`
  - Pattern: `npm test -- -t "test name pattern"`
- **Typecheck**: `cd frontend && npm run type-check`
- **Lint**: `cd frontend && npm run lint` (add `-- --fix` to auto-fix)

### Backend
- **Tests**: `cd backend && npm run test`
  - File: `npm run test -- <file-path>`
  - Pattern: `npm run test -- -t "test name pattern"`
  - E2E: `npm run test:e2e`
- **Typecheck**: `cd backend && npm run type-check`
- **Lint**: `cd backend && npm run lint` (add `-- --fix` to auto-fix)

### Smart Contracts
- **Tests**: `cd contracts && npx hardhat test`
  - Specific: `npx hardhat test --grep "test name pattern"`

## Operational Notes

### Quality Check Order
1. Typecheck first (fast feedback on type errors)
2. Lint (code style)
3. Build (compilation)
4. Tests (targeted first, then full suite)

### Test Strategy
- Run individual tests by name/pattern before full file
- Use watch mode during development: `npm test -- --watch`
- Run E2E tests only after unit tests pass

### Codebase Patterns

- **Decimal precision**: Use `decimal.js` for financial calculations (never `number` for money)
- **Type safety**: Shared types between frontend/backend in respective `/types` directories
- **Smart contracts**: Brazilian corporate law logic in contract extensions, not base OCP
- **Database**: JSONB columns store OCT-compliant data for interoperability
