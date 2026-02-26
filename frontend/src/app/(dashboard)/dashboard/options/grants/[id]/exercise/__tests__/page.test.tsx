import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExerciseOptionsPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const keys: Record<string, Record<string, string>> = {
      optionPlans: {
        'exerciseForm.back': 'Back to Grant',
        'exerciseForm.createTitle': 'Exercise Options',
        'exerciseForm.createDescription': 'Request to exercise your vested stock options.',
        'exerciseForm.grantInfo': 'Grant Information',
        'exerciseForm.exercisableOptions': 'Exercisable Options',
        'exerciseForm.strikePrice': 'Strike Price',
        'exerciseForm.sectionDetails': 'Exercise Details',
        'exerciseForm.quantity': 'Quantity',
        'exerciseForm.quantityPlaceholder': 'Enter quantity',
        'exerciseForm.quantityHelp': `Maximum: ${params?.max ?? ''}`,
        'exerciseForm.quantityRequired': 'Please enter a valid quantity',
        'exerciseForm.maxQuantity': `Cannot exceed ${params?.max ?? ''} exercisable options`,
        'exerciseForm.totalCost': 'Total Cost',
        'exerciseForm.stepDetails': 'Details',
        'exerciseForm.stepReview': 'Review',
        'exerciseForm.reviewTitle': 'Review Exercise',
        'exerciseForm.reviewEmployee': 'Employee',
        'exerciseForm.reviewPlan': 'Plan',
        'exerciseForm.reviewQuantity': 'Quantity',
        'exerciseForm.reviewStrikePrice': 'Strike Price',
        'exerciseForm.reviewTotalCost': 'Total Cost',
        'exerciseForm.exerciseButton': 'Submit Exercise',
        'exerciseForm.notActive': 'This grant is not active.',
        'exerciseForm.pendingExists': 'A pending exercise already exists.',
        'exerciseForm.noExercisable': 'No exercisable options available.',
        'grantDetail.employee': 'Employee',
        'grantDetail.plan': 'Plan',
        'grantDetail.error': 'Error loading grant details.',
        'success.exerciseCreated': 'Exercise request created successfully',
      },
    };
    return keys[namespace]?.[key] ?? key;
  },
}));

// Mock next/navigation
const mockParams = { id: 'grant-1' };
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock company context
const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

// Mock hooks
const mockUseOptionGrant = jest.fn();
const mockUseCreateExercise = jest.fn();
const mockUseOptionExercises = jest.fn();
jest.mock('@/hooks/use-option-plans', () => ({
  useOptionGrant: (...args: unknown[]) => mockUseOptionGrant(...args),
  useCreateExercise: (...args: unknown[]) => mockUseCreateExercise(...args),
  useOptionExercises: (...args: unknown[]) => mockUseOptionExercises(...args),
}));

// Mock error toast
const mockShowErrorToast = jest.fn();
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => ({ showErrorToast: mockShowErrorToast }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// --- Mock data ---

const mockGrant = {
  id: 'grant-1',
  companyId: 'c1',
  planId: 'plan-1',
  shareholderId: 'sh-1',
  employeeName: 'Maria Santos',
  employeeEmail: 'maria@example.com',
  quantity: '10000',
  strikePrice: '5.00',
  exercised: '2000',
  status: 'ACTIVE' as const,
  grantDate: '2026-01-15T00:00:00.000Z',
  expirationDate: '2036-01-15T00:00:00.000Z',
  cliffMonths: 12,
  vestingDurationMonths: 48,
  vestingFrequency: 'MONTHLY' as const,
  cliffPercentage: '25.0',
  accelerationOnCoc: true,
  terminatedAt: null,
  notes: null,
  createdBy: 'user-1',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
  plan: { id: 'plan-1', name: 'ESOP 2026' },
  shareholder: { id: 'sh-1', name: 'Maria Santos' },
  vesting: {
    vestedQuantity: '5000',
    unvestedQuantity: '5000',
    exercisableQuantity: '3000',
    vestingPercentage: '50.00',
    cliffDate: '2027-01-15T00:00:00.000Z',
    cliffMet: true,
    nextVestingDate: '2027-02-15T00:00:00.000Z',
    nextVestingAmount: '208',
  },
};

const mockMutateAsync = jest.fn().mockResolvedValue({
  id: 'ex-1',
  grantId: 'grant-1',
  quantity: '1000',
  totalCost: '5000.00',
  status: 'PENDING_PAYMENT',
});

function setupDefaultMocks(overrides?: {
  company?: Record<string, unknown>;
  grant?: Record<string, unknown>;
  createExercise?: Record<string, unknown>;
  exercises?: Record<string, unknown>;
}) {
  mockUseCompany.mockReturnValue({
    companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
    selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
    setSelectedCompanyId: jest.fn(),
    isLoading: false,
    error: null,
    ...overrides?.company,
  });
  mockUseOptionGrant.mockReturnValue({
    data: mockGrant,
    isLoading: false,
    error: null,
    ...overrides?.grant,
  });
  mockUseCreateExercise.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
    ...overrides?.createExercise,
  });
  mockUseOptionExercises.mockReturnValue({
    data: { data: [], meta: { total: 0, page: 1, limit: 1, totalPages: 0 } },
    isLoading: false,
    error: null,
    ...overrides?.exercises,
  });
}

describe('ExerciseOptionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Guard states ---

  it('renders no-company state when no company is selected', () => {
    setupDefaultMocks({
      company: { selectedCompany: null, companies: [], isLoading: false },
    });
    render(<ExerciseOptionsPage />);
    // Should show some empty state text
    expect(screen.getByText(/selecione uma empresa/i)).toBeInTheDocument();
  });

  it('renders loading skeleton while data is loading', () => {
    setupDefaultMocks({
      company: { isLoading: true },
      grant: { data: undefined, isLoading: true },
    });
    render(<ExerciseOptionsPage />);
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders error state when grant fails to load', () => {
    setupDefaultMocks({
      grant: { data: null, isLoading: false, error: new Error('Not found') },
    });
    render(<ExerciseOptionsPage />);
    expect(screen.getByText('Error loading grant details.')).toBeInTheDocument();
  });

  it('renders not active state for non-active grants', () => {
    setupDefaultMocks({
      grant: {
        data: { ...mockGrant, status: 'CANCELLED' },
        isLoading: false,
        error: null,
      },
    });
    render(<ExerciseOptionsPage />);
    expect(screen.getByText('This grant is not active.')).toBeInTheDocument();
  });

  it('renders pending exists state when exercise is already pending', () => {
    setupDefaultMocks({
      exercises: {
        data: {
          data: [{ id: 'ex-existing', status: 'PENDING_PAYMENT' }],
          meta: { total: 1, page: 1, limit: 1, totalPages: 1 },
        },
        isLoading: false,
        error: null,
      },
    });
    render(<ExerciseOptionsPage />);
    expect(screen.getByText('A pending exercise already exists.')).toBeInTheDocument();
  });

  it('renders no exercisable state when exercisableQuantity is 0', () => {
    setupDefaultMocks({
      grant: {
        data: {
          ...mockGrant,
          vesting: { ...mockGrant.vesting, exercisableQuantity: '0' },
        },
        isLoading: false,
        error: null,
      },
    });
    render(<ExerciseOptionsPage />);
    expect(screen.getByText('No exercisable options available.')).toBeInTheDocument();
  });

  // --- Step 0: Details form ---

  it('renders grant info card with employee name and plan', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('ESOP 2026')).toBeInTheDocument();
  });

  it('renders exercisable quantity in grant info', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);
    expect(screen.getByText('Exercisable Options')).toBeInTheDocument();
  });

  it('renders strike price in grant info', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);
    expect(screen.getByText('Strike Price')).toBeInTheDocument();
  });

  it('renders quantity input field', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);
    const input = screen.getByPlaceholderText('Enter quantity');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'number');
  });

  it('renders step indicator with Details and Review steps', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getAllByText('Review').length).toBeGreaterThanOrEqual(1);
  });

  it('disables review button when no quantity is entered', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);
    // The "Review" button should be disabled
    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    expect(button).toBeDisabled();
  });

  it('shows validation error when quantity exceeds exercisable', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);
    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '5000' } });

    // Click review to trigger validation
    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(button!);

    expect(screen.getByText(/cannot exceed/i)).toBeInTheDocument();
  });

  it('shows total cost calculation when quantity is entered', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);
    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '1000' } });

    expect(screen.getByText('Total Cost')).toBeInTheDocument();
  });

  it('shows back link to grant detail', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);
    const backLink = screen.getByText('Back to Grant');
    expect(backLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/options/grants/grant-1',
    );
  });

  // --- Step 1: Review ---

  it('advances to review step when valid quantity is entered', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);

    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '1000' } });

    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(button!);

    // Review step should show review title
    expect(screen.getByText('Review Exercise')).toBeInTheDocument();
  });

  it('shows employee name on review step', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);

    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '1000' } });

    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(button!);

    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
  });

  it('shows plan name on review step', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);

    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '1000' } });

    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(button!);

    expect(screen.getByText('ESOP 2026')).toBeInTheDocument();
  });

  it('can go back to details step from review', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);

    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '1000' } });

    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(button!);

    // Click "Details" button to go back (it's the button, not the step label)
    const detailsElements = screen.getAllByText('Details');
    const backButton = detailsElements.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(backButton!);

    expect(screen.getByText('Exercise Details')).toBeInTheDocument();
  });

  it('renders submit button on review step', () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);

    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '1000' } });

    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(button!);

    expect(screen.getByText('Submit Exercise')).toBeInTheDocument();
  });

  it('calls createExercise mutation on submit', async () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);

    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '1000' } });

    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(button!);

    const submitButton = screen.getByText('Submit Exercise');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        grantId: 'grant-1',
        quantity: '1000',
      });
    });
  });

  it('navigates to grant page after successful submission', async () => {
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);

    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '1000' } });

    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(button!);

    const submitButton = screen.getByText('Submit Exercise');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/options/grants/grant-1');
    });
  });

  it('shows error toast on submission failure', async () => {
    const error = new Error('Server error');
    mockMutateAsync.mockRejectedValueOnce(error);
    setupDefaultMocks();
    render(<ExerciseOptionsPage />);

    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '1000' } });

    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(button!);

    const submitButton = screen.getByText('Submit Exercise');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(error);
    });
  });

  it('shows loading state on submit button while pending', () => {
    setupDefaultMocks({
      createExercise: { mutateAsync: mockMutateAsync, isPending: true },
    });
    render(<ExerciseOptionsPage />);

    const input = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(input, { target: { value: '1000' } });

    const reviewButtons = screen.getAllByText('Review');
    const button = reviewButtons.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(button!);

    // The submit button should have the spinner class
    const submitButton = screen.getByText('Submit Exercise');
    expect(submitButton.closest('button')).toHaveClass('opacity-75');
  });
});
