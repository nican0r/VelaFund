import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateOptionPlanPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const fn = (key: string) => {
      const keys: Record<string, Record<string, string>> = {
        optionPlans: {
          title: 'Option Plans',
          createTitle: 'Create Option Plan',
          createDescription: 'Configure a new stock option plan for your company.',
          empty: 'No option plans found.',
          'terminationPolicy.forfeiture': 'Forfeiture',
          'terminationPolicy.acceleration': 'Acceleration',
          'terminationPolicy.proRata': 'Pro-rata',
          'form.sectionDetails': 'Plan Details',
          'form.sectionTerms': 'Plan Terms',
          'form.name': 'Plan Name',
          'form.namePlaceholder': 'e.g., 2026 Employee Stock Option Plan',
          'form.shareClass': 'Share Class',
          'form.shareClassPlaceholder': 'Select a share class',
          'form.totalPoolSize': 'Total Pool Size',
          'form.totalPoolSizePlaceholder': 'e.g., 100000',
          'form.totalPoolSizeHelp': 'Total number of options available for grants under this plan.',
          'form.boardApprovalDate': 'Board Approval Date',
          'form.boardApprovalDateHelp': 'Date the board approved this option plan.',
          'form.terminationPolicy': 'Termination Policy',
          'form.terminationPolicyHelp': 'What happens to unvested options when an employee is terminated.',
          'form.forfeitureDescription': 'All unvested options are forfeited upon termination.',
          'form.accelerationDescription': 'All unvested options vest immediately upon termination.',
          'form.proRataDescription': 'A proportional amount of unvested options vest upon termination.',
          'form.exerciseWindowDays': 'Exercise Window (days)',
          'form.exerciseWindowDaysHelp': 'Number of days after termination an employee can exercise vested options (1–365).',
          'form.notes': 'Notes',
          'form.notesPlaceholder': 'Additional notes about the plan...',
          'form.stepDetails': 'Details',
          'form.stepReview': 'Review',
          'form.reviewName': 'Plan Name',
          'form.reviewShareClass': 'Share Class',
          'form.reviewTotalPoolSize': 'Total Pool Size',
          'form.reviewTerminationPolicy': 'Termination Policy',
          'form.reviewExerciseWindowDays': 'Exercise Window',
          'form.reviewExerciseWindowDaysSuffix': 'days',
          'form.reviewBoardApprovalDate': 'Board Approval Date',
          'form.reviewNotes': 'Notes',
          'success.created': 'Option plan created successfully',
        },
        common: {
          cancel: 'Cancel',
          next: 'Next',
          back: 'Back',
          confirm: 'Confirm',
          loading: 'Loading...',
        },
        errors: {
          'val.required': 'Required',
          'val.mustBePositive': 'Must be greater than zero',
          'val.maxValue': 'Exceeds maximum allowed value',
        },
      };
      if (!namespace) {
        const parts = key.split('.');
        if (parts.length >= 2) {
          const ns = parts[0];
          const k = parts.slice(1).join('.');
          return keys[ns]?.[k] ?? key;
        }
      }
      return keys[namespace]?.[key] ?? key;
    };
    return fn;
  },
}));

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock company context
const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

// Mock hooks
const mockMutateAsync = jest.fn();
const mockUseCreateOptionPlan = jest.fn();
const mockUseShareClasses = jest.fn();

jest.mock('@/hooks/use-option-plans', () => ({
  useCreateOptionPlan: (...args: unknown[]) =>
    mockUseCreateOptionPlan(...args),
}));

jest.mock('@/hooks/use-share-classes', () => ({
  useShareClasses: (...args: unknown[]) => mockUseShareClasses(...args),
}));

// Mock error toast
const mockShowErrorToast = jest.fn();
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => mockShowErrorToast,
}));

// --- Test data ---

const mockCompany = {
  id: 'company-1',
  name: 'Test Corp',
  cnpj: '12.345.678/0001-90',
  entityType: 'LTDA',
  status: 'ACTIVE',
};

const mockShareClasses = [
  {
    id: 'sc-1',
    className: 'Quotas Ordinárias',
    type: 'QUOTA',
    totalAuthorized: '100000',
    totalIssued: '50000',
    votesPerShare: 1,
    companyId: 'company-1',
  },
  {
    id: 'sc-2',
    className: 'Ações Preferenciais',
    type: 'PREFERRED_SHARES',
    totalAuthorized: '50000',
    totalIssued: '10000',
    votesPerShare: 0,
    companyId: 'company-1',
  },
];

// --- Setup ---

function setup() {
  mockUseCompany.mockReturnValue({
    selectedCompany: mockCompany,
    isLoading: false,
  });

  mockUseCreateOptionPlan.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });

  mockUseShareClasses.mockReturnValue({
    data: {
      data: mockShareClasses,
      meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
    },
    isLoading: false,
  });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByTestId('input-name'), {
    target: { value: '2026 Employee Stock Option Plan' },
  });
  fireEvent.change(screen.getByTestId('select-shareClassId'), {
    target: { value: 'sc-1' },
  });
  fireEvent.change(screen.getByTestId('input-totalPoolSize'), {
    target: { value: '150000' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setup();
});

// --- Tests ---

describe('CreateOptionPlanPage', () => {
  // --- Rendering ---

  it('renders the page title and description', () => {
    render(<CreateOptionPlanPage />);
    expect(screen.getByText('Create Option Plan')).toBeInTheDocument();
    expect(
      screen.getByText('Configure a new stock option plan for your company.'),
    ).toBeInTheDocument();
  });

  it('renders back link to option plans list', () => {
    render(<CreateOptionPlanPage />);
    const backLink = screen.getByText('Option Plans');
    expect(backLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/options',
    );
  });

  it('renders step indicator with Details and Review', () => {
    render(<CreateOptionPlanPage />);
    expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders no company state when no company is selected', () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: null,
      isLoading: false,
    });
    render(<CreateOptionPlanPage />);
    expect(screen.getByText('No option plans found.')).toBeInTheDocument();
  });

  // --- Plan Details Section ---

  it('renders Plan Details section with name, share class, and pool size', () => {
    render(<CreateOptionPlanPage />);
    expect(screen.getByText('Plan Details')).toBeInTheDocument();
    expect(screen.getByText('Plan Name')).toBeInTheDocument();
    expect(screen.getByTestId('input-name')).toBeInTheDocument();
    expect(screen.getByText('Share Class')).toBeInTheDocument();
    expect(screen.getByTestId('select-shareClassId')).toBeInTheDocument();
    expect(screen.getByText('Total Pool Size')).toBeInTheDocument();
    expect(screen.getByTestId('input-totalPoolSize')).toBeInTheDocument();
  });

  it('renders share class dropdown with options', () => {
    render(<CreateOptionPlanPage />);
    const select = screen.getByTestId('select-shareClassId');
    expect(select).toBeInTheDocument();
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3); // placeholder + 2 share classes
    expect(options[1].textContent).toContain('Quotas Ordinárias');
    expect(options[2].textContent).toContain('Ações Preferenciais');
  });

  it('renders board approval date field', () => {
    render(<CreateOptionPlanPage />);
    expect(screen.getByText('Board Approval Date')).toBeInTheDocument();
    expect(screen.getByTestId('input-boardApprovalDate')).toBeInTheDocument();
  });

  it('renders pool size help text', () => {
    render(<CreateOptionPlanPage />);
    expect(
      screen.getByText('Total number of options available for grants under this plan.'),
    ).toBeInTheDocument();
  });

  // --- Plan Terms Section ---

  it('renders Plan Terms section with termination policy cards', () => {
    render(<CreateOptionPlanPage />);
    expect(screen.getByText('Plan Terms')).toBeInTheDocument();
    expect(screen.getByTestId('policy-card-FORFEITURE')).toBeInTheDocument();
    expect(screen.getByTestId('policy-card-ACCELERATION')).toBeInTheDocument();
    expect(screen.getByTestId('policy-card-PRO_RATA')).toBeInTheDocument();
  });

  it('defaults to FORFEITURE termination policy selected', () => {
    render(<CreateOptionPlanPage />);
    const forfeitureCard = screen.getByTestId('policy-card-FORFEITURE');
    expect(forfeitureCard).toHaveClass('border-ocean-600');
  });

  it('changes selected termination policy when a card is clicked', () => {
    render(<CreateOptionPlanPage />);
    const accelerationCard = screen.getByTestId('policy-card-ACCELERATION');
    fireEvent.click(accelerationCard);
    expect(accelerationCard).toHaveClass('border-ocean-600');
    expect(screen.getByTestId('policy-card-FORFEITURE')).not.toHaveClass(
      'border-ocean-600',
    );
  });

  it('renders termination policy labels', () => {
    render(<CreateOptionPlanPage />);
    expect(screen.getByText('Forfeiture')).toBeInTheDocument();
    expect(screen.getByText('Acceleration')).toBeInTheDocument();
    expect(screen.getByText('Pro-rata')).toBeInTheDocument();
  });

  it('renders exercise window field with default value of 90', () => {
    render(<CreateOptionPlanPage />);
    expect(screen.getByText('Exercise Window (days)')).toBeInTheDocument();
    const exerciseInput = screen.getByTestId('input-exerciseWindowDays');
    expect(exerciseInput).toHaveValue(90);
  });

  it('renders exercise window help text', () => {
    render(<CreateOptionPlanPage />);
    expect(
      screen.getByText(
        'Number of days after termination an employee can exercise vested options (1–365).',
      ),
    ).toBeInTheDocument();
  });

  it('renders notes field', () => {
    render(<CreateOptionPlanPage />);
    expect(screen.getByTestId('input-notes')).toBeInTheDocument();
  });

  // --- Validation ---

  it('shows required errors when clicking Next with empty required fields', () => {
    render(<CreateOptionPlanPage />);
    // Clear default exercise window value to test only required fields
    fireEvent.click(screen.getByTestId('next-button'));
    const requiredErrors = screen.getAllByText('Required');
    expect(requiredErrors.length).toBeGreaterThanOrEqual(3); // name, shareClass, totalPoolSize
  });

  it('shows must be positive error for zero pool size', () => {
    render(<CreateOptionPlanPage />);
    fireEvent.change(screen.getByTestId('input-name'), {
      target: { value: 'Test Plan' },
    });
    fireEvent.change(screen.getByTestId('select-shareClassId'), {
      target: { value: 'sc-1' },
    });
    fireEvent.change(screen.getByTestId('input-totalPoolSize'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('shows must be positive error for negative pool size', () => {
    render(<CreateOptionPlanPage />);
    fireEvent.change(screen.getByTestId('input-name'), {
      target: { value: 'Test Plan' },
    });
    fireEvent.change(screen.getByTestId('select-shareClassId'), {
      target: { value: 'sc-1' },
    });
    fireEvent.change(screen.getByTestId('input-totalPoolSize'), {
      target: { value: '-100' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('shows error for exercise window out of range', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-exerciseWindowDays'), {
      target: { value: '500' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Exceeds maximum allowed value'),
    ).toBeInTheDocument();
  });

  it('shows error for exercise window of zero', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-exerciseWindowDays'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Exceeds maximum allowed value'),
    ).toBeInTheDocument();
  });

  it('clears field error when field value changes after submission', () => {
    render(<CreateOptionPlanPage />);
    fireEvent.click(screen.getByTestId('next-button'));
    const requiredErrors = screen.getAllByText('Required');
    expect(requiredErrors.length).toBeGreaterThanOrEqual(3);

    // Change name field
    fireEvent.change(screen.getByTestId('input-name'), {
      target: { value: 'Test Plan' },
    });
    // Should have fewer errors
    const remainingErrors = screen.getAllByText('Required');
    expect(remainingErrors.length).toBeLessThan(requiredErrors.length);
  });

  // --- Step Navigation ---

  it('advances to review step when form is valid', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-name')).toHaveTextContent(
      '2026 Employee Stock Option Plan',
    );
  });

  it('shows review data correctly', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-name')).toHaveTextContent(
      '2026 Employee Stock Option Plan',
    );
    expect(screen.getByTestId('review-shareClass')).toHaveTextContent(
      'Quotas Ordinárias',
    );
    expect(screen.getByTestId('review-totalPoolSize')).toBeInTheDocument();
    expect(screen.getByTestId('review-terminationPolicy')).toHaveTextContent(
      'Forfeiture',
    );
    expect(screen.getByTestId('review-exerciseWindowDays')).toHaveTextContent(
      '90 days',
    );
  });

  it('shows formatted total pool size in review', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    // 150000 formatted as pt-BR = 150.000
    expect(screen.getByTestId('review-totalPoolSize').textContent).toContain(
      '150.000',
    );
  });

  it('shows optional board approval date in review only when filled', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    // Should not show when empty
    expect(screen.queryByTestId('review-boardApprovalDate')).not.toBeInTheDocument();
  });

  it('shows board approval date in review when filled', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-boardApprovalDate'), {
      target: { value: '2026-03-15' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-boardApprovalDate')).toBeInTheDocument();
  });

  it('shows optional notes in review only when filled', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.queryByTestId('review-notes')).not.toBeInTheDocument();
  });

  it('shows notes in review when filled', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-notes'), {
      target: { value: 'Employee option plan notes' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-notes')).toHaveTextContent(
      'Employee option plan notes',
    );
  });

  it('shows acceleration policy in review when selected', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('policy-card-ACCELERATION'));
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-terminationPolicy')).toHaveTextContent(
      'Acceleration',
    );
  });

  it('shows pro-rata policy in review when selected', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('policy-card-PRO_RATA'));
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-terminationPolicy')).toHaveTextContent(
      'Pro-rata',
    );
  });

  it('navigates back from review to details step', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-name')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('back-button'));
    expect(screen.getByText('Plan Details')).toBeInTheDocument();
  });

  // --- Form Submission ---

  it('submits the form with correct payload', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'plan-1' });
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: '2026 Employee Stock Option Plan',
        shareClassId: 'sc-1',
        totalPoolSize: '150000',
        terminationPolicy: 'FORFEITURE',
        exerciseWindowDays: 90,
      });
    });
  });

  it('includes optional fields in payload when filled', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'plan-1' });
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-boardApprovalDate'), {
      target: { value: '2026-03-15' },
    });
    fireEvent.change(screen.getByTestId('input-notes'), {
      target: { value: 'Plan notes' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: '2026 Employee Stock Option Plan',
        shareClassId: 'sc-1',
        totalPoolSize: '150000',
        terminationPolicy: 'FORFEITURE',
        exerciseWindowDays: 90,
        boardApprovalDate: '2026-03-15',
        notes: 'Plan notes',
      });
    });
  });

  it('submits with ACCELERATION policy when selected', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'plan-1' });
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('policy-card-ACCELERATION'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ terminationPolicy: 'ACCELERATION' }),
      );
    });
  });

  it('submits with custom exercise window days', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'plan-1' });
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-exerciseWindowDays'), {
      target: { value: '180' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ exerciseWindowDays: 180 }),
      );
    });
  });

  it('shows success toast and navigates after successful creation', async () => {
    const { toast } = require('sonner');
    mockMutateAsync.mockResolvedValue({ id: 'plan-1' });
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Option plan created successfully',
      );
      expect(mockPush).toHaveBeenCalledWith('/dashboard/options');
    });
  });

  it('shows error toast on API failure', async () => {
    const apiError = new Error('Server error');
    mockMutateAsync.mockRejectedValue(apiError);
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(apiError);
    });
  });

  it('disables submit button when mutation is pending', () => {
    mockUseCreateOptionPlan.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    const submitButton = screen.getByTestId('submit-button');
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Loading...');
  });

  // --- Action buttons ---

  it('renders Next and Cancel buttons on details step', () => {
    render(<CreateOptionPlanPage />);
    expect(screen.getByTestId('next-button')).toHaveTextContent('Next');
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders Confirm and Back buttons on review step', () => {
    render(<CreateOptionPlanPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('submit-button')).toHaveTextContent('Confirm');
    expect(screen.getByTestId('back-button')).toHaveTextContent('Back');
  });

  it('renders cancel link to option plans list', () => {
    render(<CreateOptionPlanPage />);
    const cancelLinks = screen.getAllByText('Cancel');
    const cancelLink = cancelLinks.find(
      (el) => el.closest('a')?.getAttribute('href') === '/dashboard/options',
    );
    expect(cancelLink).toBeTruthy();
  });

  // --- Termination policy help text ---

  it('shows termination policy help text', () => {
    render(<CreateOptionPlanPage />);
    expect(
      screen.getByText(
        'What happens to unvested options when an employee is terminated.',
      ),
    ).toBeInTheDocument();
  });
});
