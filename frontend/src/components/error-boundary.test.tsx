import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './error-boundary';

// Suppress console.error for expected errors in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Error: Test error') ||
        args[0].includes('The above error occurred'))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

function ThrowingChild() {
  throw new Error('Test error');
}

function WorkingChild() {
  return <div>Working content</div>;
}

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <WorkingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Working content')).toBeInTheDocument();
  });

  it('should render fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
    expect(screen.getByText(/Ocorreu um erro inesperado/)).toBeInTheDocument();
    expect(screen.getByText('Recarregar')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error</div>}>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom error')).toBeInTheDocument();
  });

  it('should reload page when Recarregar is clicked', () => {
    const reloadMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText('Recarregar'));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
