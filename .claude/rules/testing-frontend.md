# Frontend Testing Rules

## Mandatory Requirements
- Create `ComponentName.test.tsx` for every new component
- Run `npm test` after EVERY component change
- Fix broken tests before committing — never comment out or skip them
- Mock external dependencies (APIs, Privy SDK)
- Include test results in completion summary

## Stack
- Jest + React Testing Library (@testing-library/react, @testing-library/user-event, @testing-library/jest-dom)
- Run with coverage: `npm test -- --coverage`

## What to Test
- **Rendering**: initial state, loading/error/empty states, conditional rendering
- **Props**: required props, defaults, updates on change
- **Interactions**: clicks, form inputs, form submission, keyboard nav
- **Integration**: API calls, data fetching states, error handling
- **Accessibility**: ARIA labels, keyboard navigation, focus management
- Test user behavior, not implementation details

## Provider/Layout Integration Testing
- When a component calls a context hook (`useCompany`, `useAuth`, etc.), include at least one test that wraps it in the **real provider** — not a module-level mock — to verify the component works within its actual provider hierarchy
- Layout components (`DashboardLayout`, `Sidebar`, `Topbar`) that compose multiple context-dependent children must have integration tests rendering the full layout tree with real providers to catch misplaced provider boundaries
- Mocking context at the module level (`jest.mock(...)`) is fine for unit-testing individual features, but never sufficient on its own — it hides provider hierarchy bugs where a component sits outside its required provider in the real component tree
- Every context provider (`AuthProvider`, `CompanyProvider`, etc.) must have its own dedicated test file that renders the **real provider** with controlled mocks of its dependencies (e.g., mock `usePrivy` but render real `AuthProvider`). Tests must verify the full state machine: initial → loading → success/failure → final state. Module-level mocking of a provider in consuming component tests is not a substitute for testing the provider itself.

## Coverage
- General minimum: 80% statements/lines
- Critical components (auth, investments, KYC, smart contract interactions): 100%
