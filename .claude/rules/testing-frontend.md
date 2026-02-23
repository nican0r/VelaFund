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

## Coverage
- General minimum: 80% statements/lines
- Critical components (auth, investments, KYC, smart contract interactions): 100%
