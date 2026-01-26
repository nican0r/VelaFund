# Frontend Testing Rules and Guidelines

## Core Testing Requirements

### 🔴 MANDATORY: Test Implementation and Execution

**All agents MUST follow these testing rules when working on frontend components:**

1. **For NEW Components:**
   - ALWAYS create corresponding test files for every new component
   - Test file naming convention: `ComponentName.test.tsx` or `ComponentName.spec.tsx`
   - Tests must be created in the same PR/commit as the component
   - Run tests immediately after implementation to verify they pass

2. **For EXISTING Components:**
   - ALWAYS run existing tests after making any modifications
   - Update tests if the component's behavior or props change
   - Add new test cases for new functionality
   - Fix any broken tests before marking the task as complete

3. **Test Execution Requirements:**
   - Run `npm test` or `yarn test` after EVERY component change
   - Ensure all tests pass before committing code
   - If tests fail, fix them immediately - do not proceed with broken tests
   - Include test results in your completion summary

## Testing Framework and Tools

### Technology Stack
- **Testing Library**: Jest + React Testing Library
- **Component Testing**: @testing-library/react
- **User Event Simulation**: @testing-library/user-event
- **Test Runner**: Jest with Next.js configuration
- **Coverage Tool**: Jest coverage reports

### Setup Commands
```bash
# Install testing dependencies (if not already installed)
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- ComponentName.test.tsx
```

## What to Test

### Component Testing Checklist

#### 1. **Rendering Tests**
- [ ] Component renders without crashing
- [ ] Correct initial state is displayed
- [ ] Conditional rendering works as expected
- [ ] Loading states display correctly
- [ ] Error states display correctly
- [ ] Empty states display correctly

#### 2. **Props Testing**
- [ ] Required props work correctly
- [ ] Optional props have proper defaults
- [ ] Props validation works
- [ ] Component updates when props change

#### 3. **User Interaction Tests**
- [ ] Click events trigger correct actions
- [ ] Form inputs update state correctly
- [ ] Form submission works as expected
- [ ] Keyboard navigation works
- [ ] Hover states work (if applicable)

#### 4. **Integration Tests**
- [ ] API calls are triggered correctly
- [ ] Data fetching states work
- [ ] Error handling from API works
- [ ] Navigation/routing works correctly

#### 5. **Accessibility Tests**
- [ ] ARIA labels are present and correct
- [ ] Keyboard navigation is functional
- [ ] Screen reader compatibility
- [ ] Focus management works correctly

## Test File Structure Template

```typescript
// ComponentName.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ComponentName } from './ComponentName';

// Mock any dependencies
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: '1', name: 'Test User' },
    isAuthenticated: true
  }))
}));

describe('ComponentName', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<ComponentName />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should display correct initial state', () => {
      render(<ComponentName title="Test Title" />);
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      render(<ComponentName isLoading={true} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should show error state', () => {
      render(<ComponentName error="Something went wrong" />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle button click', async () => {
      const handleClick = jest.fn();
      render(<ComponentName onClick={handleClick} />);

      const button = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should handle form input', async () => {
      render(<ComponentName />);

      const input = screen.getByLabelText(/email/i);
      await userEvent.type(input, 'test@example.com');

      expect(input).toHaveValue('test@example.com');
    });
  });

  describe('API Integration', () => {
    it('should fetch data on mount', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        data: { items: [] }
      });

      render(<ComponentName fetchData={mockFetch} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('API Error'));

      render(<ComponentName fetchData={mockFetch} />);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ComponentName />);

      expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      render(<ComponentName />);

      const firstButton = screen.getAllByRole('button')[0];
      firstButton.focus();

      expect(firstButton).toHaveFocus();
    });
  });
});
```

## Component-Specific Testing Guidelines

### 1. **Authentication Components** (`/components/auth/*`)
```typescript
// Test login flow, token handling, error states
it('should handle successful login', async () => {
  // Test implementation
});

it('should display validation errors', async () => {
  // Test implementation
});

it('should redirect after successful auth', async () => {
  // Test implementation
});
```

### 2. **Investment Components** (`/components/investments/*`)
```typescript
// Test investment flow, amount validation, transaction states
it('should validate investment amount', async () => {
  // Test implementation
});

it('should show transaction pending state', async () => {
  // Test implementation
});

it('should handle transaction errors', async () => {
  // Test implementation
});
```

### 3. **Form Components**
```typescript
// Test validation, submission, error handling
it('should validate required fields', async () => {
  // Test implementation
});

it('should prevent submission with invalid data', async () => {
  // Test implementation
});
```

### 4. **Dashboard Components** (`/components/dashboard/*`)
```typescript
// Test data display, filtering, sorting
it('should display portfolio metrics correctly', () => {
  // Test implementation
});

it('should filter investments by status', async () => {
  // Test implementation
});
```

## Testing Best Practices

### DO's ✅
- **DO** test user behavior, not implementation details
- **DO** use data-testid attributes for hard-to-query elements
- **DO** test both success and failure scenarios
- **DO** mock external dependencies (APIs, Privy SDK, etc.)
- **DO** write descriptive test names that explain what is being tested
- **DO** group related tests using describe blocks
- **DO** clean up after tests (unmount components, clear mocks)
- **DO** test accessibility features

### DON'Ts ❌
- **DON'T** test third-party library internals
- **DON'T** test implementation details that might change
- **DON'T** write tests that depend on other tests
- **DON'T** use random or time-based data without mocking
- **DON'T** leave console.log statements in tests
- **DON'T** skip writing tests to save time

## Coverage Requirements

### Minimum Coverage Targets
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

### Critical Components (100% Coverage Required)
- Authentication flows
- Payment/Investment flows
- KYC submission components
- Smart contract interaction components

## Test Execution Workflow

### For Agents/Developers

1. **Before Starting Work:**
   ```bash
   # Run existing tests to ensure clean slate
   npm test
   ```

2. **After Creating New Component:**
   ```bash
   # Create test file immediately
   touch src/components/ComponentName.test.tsx
   # Write tests
   # Run tests to verify
   npm test -- ComponentName.test.tsx
   ```

3. **After Modifying Existing Component:**
   ```bash
   # Run specific component tests
   npm test -- ComponentName.test.tsx
   # Run all tests to check for side effects
   npm test
   ```

4. **Before Committing:**
   ```bash
   # Run all tests with coverage
   npm test -- --coverage
   # Ensure all tests pass
   # Check coverage meets requirements
   ```

## Common Testing Scenarios for VelaFund

### 1. Testing Privy Authentication
```typescript
import { PrivyProvider } from '@privy-io/react-auth';

const mockPrivy = {
  authenticated: true,
  user: { id: 'test-user', wallet: { address: '0x123...' } },
  login: jest.fn(),
  logout: jest.fn()
};

jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => mockPrivy,
  PrivyProvider: ({ children }: any) => children
}));
```

### 2. Testing Investment Flows
```typescript
it('should handle investment submission', async () => {
  const mockInvest = jest.fn().mockResolvedValue({
    success: true,
    txHash: '0xabc...'
  });

  render(<InvestmentForm onInvest={mockInvest} />);

  // Fill in investment amount
  await userEvent.type(screen.getByLabelText(/amount/i), '1000');

  // Submit form
  await userEvent.click(screen.getByRole('button', { name: /invest/i }));

  // Verify API call
  expect(mockInvest).toHaveBeenCalledWith({
    amount: 1000,
    // ... other expected parameters
  });

  // Check for success message
  await waitFor(() => {
    expect(screen.getByText(/investment successful/i)).toBeInTheDocument();
  });
});
```

### 3. Testing API Error Handling
```typescript
it('should display error message on API failure', async () => {
  const mockFetch = jest.fn().mockRejectedValue(
    new Error('Network error')
  );

  render(<StartupList fetchStartups={mockFetch} />);

  await waitFor(() => {
    expect(screen.getByText(/failed to load startups/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
```

## Continuous Integration

### GitHub Actions Test Workflow
```yaml
# .github/workflows/frontend-tests.yml
name: Frontend Tests

on:
  push:
    paths:
      - 'frontend/**'
  pull_request:
    paths:
      - 'frontend/**'

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run tests
        run: cd frontend && npm test -- --coverage --watchAll=false

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info
```

## Emergency Procedures

### If Tests Are Failing:
1. **DON'T** comment out or skip failing tests
2. **DO** investigate why they're failing
3. **DO** fix the underlying issue
4. **DO** update tests if requirements have changed
5. **DO** document any significant changes in test approach

### If Unable to Write Tests:
1. Mark the component with a TODO comment
2. Create a GitHub issue for missing tests
3. Document why tests couldn't be written
4. Schedule follow-up to add tests

---

## Summary for Agents

**REMEMBER: Every frontend component change requires:**
1. ✅ Write/update tests IMMEDIATELY after component implementation
2. ✅ Run tests to verify they pass
3. ✅ Fix any broken tests before proceeding
4. ✅ Include test status in your completion report
5. ✅ Aim for minimum 80% code coverage

**Testing is not optional - it's a core part of the development process for VelaFund MVP.**