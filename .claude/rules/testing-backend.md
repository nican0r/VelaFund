# Backend Testing Rules

## Mandatory Requirements
- Create `*.spec.ts` files for every new module, controller, service, and resolver
- Run `npm test` after EVERY backend change
- Fix broken tests before committing — never comment out or skip them
- ALWAYS mock external services (Privy, Verifik, AWS, blockchain, email) — never make real calls
- Include test results in completion summary

## Stack
- Jest + @nestjs/testing (Test.createTestingModule)
- jest.mock() and jest.spyOn() for mocking
- @faker-js/faker for test data
- Run with coverage: `npm test -- --coverage --watchAll=false`

## File Naming
- Unit tests: `*.spec.ts` (e.g., `company.service.spec.ts`)
- E2E tests: `*.e2e-spec.ts` (e.g., `company.e2e-spec.ts`)
- Place unit tests next to source files
- Place E2E tests in `test/` directory

## Setup Commands
- `npm test` — run all unit tests
- `npm test -- --watch` — watch mode
- `npm test -- --coverage` — coverage report
- `npm test -- --testPathPattern=company` — specific module
- `npm run test:e2e` — run E2E tests

## What to Test
- **Services**: business logic, error handling, database transactions, edge cases
- **Controllers**: request validation (400), auth (401/403), success (200/201), not found (404), pagination, permissions
- **Guards**: role-based access, permission checks, JWT validation
- **Interceptors**: response transformation, audit logging
- **Pipes**: input validation, data transformation
- **Auth**: Privy token verification, JWT validation, user creation on first login

## Test Structure
```typescript
describe('CompanyService', () => {
  let service: CompanyService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get(CompanyService);
    prisma = module.get(PrismaService);
  });

  it('should create a company', async () => {
    prisma.company.create.mockResolvedValue(mockCompany);
    const result = await service.create(createDto);
    expect(result).toEqual(mockCompany);
  });
});
```

## Mocking Patterns
- Use `jest.mock()` for module-level mocks
- Use `jest.spyOn()` for partial mocks
- Use `mockDeep` from `jest-mock-extended` for Prisma client mocking
- Use `overrideProvider()` in test modules for DI-based mocks

## Coverage
- General minimum: 85% statements/lines
- Critical components (auth, investments, blockchain, financial calculations): 95%
