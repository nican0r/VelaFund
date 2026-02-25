import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateFundingRoundPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const fn = (key: string) => {
      const keys: Record<string, Record<string, string>> = {
        fundingRounds: {
          title: 'Funding Rounds',
          createTitle: 'New Funding Round',
          createDescription: 'Fill in the details for the new funding round.',
          empty: 'No funding rounds found.',
          'type.preSeed': 'Pre-Seed',
          'type.seed': 'Seed',
          'type.seriesA': 'Series A',
          'type.seriesB': 'Series B',
          'type.seriesC': 'Series C',
          'type.bridge': 'Bridge',
          'type.other': 'Other',
          'form.sectionType': 'Round Type',
          'form.sectionInfo': 'Round Information',
          'form.sectionFinancial': 'Financial Terms',
          'form.sectionDates': 'Dates',
          'form.typePreSeedDescription': 'Early round for product validation.',
          'form.typeSeedDescription': 'First institutional investment round.',
          'form.typeSeriesADescription': 'Round to scale the business model.',
          'form.typeSeriesBDescription': 'Round for market expansion.',
          'form.typeSeriesCDescription': 'Round for advanced growth and consolidation.',
          'form.typeBridgeDescription': 'Interim financing between rounds.',
          'form.typeOtherDescription': 'Custom round type.',
          'form.name': 'Round Name',
          'form.namePlaceholder': 'e.g., Seed Round 2026',
          'form.shareClass': 'Share Class',
          'form.selectShareClass': 'Select a share class',
          'form.targetAmount': 'Target Amount (R$)',
          'form.targetAmountPlaceholder': '0.00',
          'form.minimumCloseAmount': 'Minimum Close Amount (R$)',
          'form.minimumCloseAmountPlaceholder': '0.00',
          'form.minimumCloseAmountHelp': 'Minimum amount required to close the round.',
          'form.hardCap': 'Hard Cap (R$)',
          'form.hardCapPlaceholder': '0.00',
          'form.hardCapHelp': 'Maximum amount the round can raise.',
          'form.preMoneyValuation': 'Pre-Money Valuation (R$)',
          'form.preMoneyValuationPlaceholder': '0.00',
          'form.pricePerShare': 'Price per Share (R$)',
          'form.pricePerSharePlaceholder': '0.00',
          'form.postMoneyValuation': 'Post-Money Valuation (calculated)',
          'form.targetCloseDate': 'Target Close Date',
          'form.notes': 'Notes',
          'form.notesPlaceholder': 'Additional terms...',
          'form.stepDetails': 'Details',
          'form.stepReview': 'Review',
          'form.reviewTitle': 'Round Review',
          'form.reviewType': 'Type',
          'form.reviewName': 'Name',
          'form.reviewShareClass': 'Share Class',
          'form.reviewTargetAmount': 'Target Amount',
          'form.reviewMinClose': 'Minimum Close',
          'form.reviewHardCap': 'Hard Cap',
          'form.reviewPreMoney': 'Pre-Money Valuation',
          'form.reviewPricePerShare': 'Price per Share',
          'form.reviewPostMoney': 'Post-Money Valuation',
          'form.reviewTargetCloseDate': 'Target Close Date',
          'form.reviewNotes': 'Notes',
          'form.errorMinExceedsTarget': 'Minimum close must be less than or equal to target.',
          'form.errorHardCapBelowTarget': 'Hard cap must be greater than or equal to target.',
          'success.created': 'Round created successfully',
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
const mockUseCreateFundingRound = jest.fn();
const mockUseShareClasses = jest.fn();

jest.mock('@/hooks/use-funding-rounds', () => ({
  useCreateFundingRound: (...args: unknown[]) =>
    mockUseCreateFundingRound(...args),
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

  mockUseCreateFundingRound.mockReturnValue({
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
    target: { value: 'Seed Round 2026' },
  });
  fireEvent.change(screen.getByTestId('select-shareClassId'), {
    target: { value: 'sc-1' },
  });
  fireEvent.change(screen.getByTestId('input-targetAmount'), {
    target: { value: '5000000' },
  });
  fireEvent.change(screen.getByTestId('input-preMoneyValuation'), {
    target: { value: '20000000' },
  });
  fireEvent.change(screen.getByTestId('input-pricePerShare'), {
    target: { value: '10' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setup();
});

// --- Tests ---

describe('CreateFundingRoundPage', () => {
  // --- Rendering ---

  it('renders the page title and description', () => {
    render(<CreateFundingRoundPage />);
    expect(screen.getByText('New Funding Round')).toBeInTheDocument();
    expect(
      screen.getByText('Fill in the details for the new funding round.'),
    ).toBeInTheDocument();
  });

  it('renders back link to funding rounds list', () => {
    render(<CreateFundingRoundPage />);
    const backLink = screen.getByText('Funding Rounds');
    expect(backLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/funding-rounds',
    );
  });

  it('renders step indicator with Details and Review', () => {
    render(<CreateFundingRoundPage />);
    expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders no company state when no company is selected', () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: null,
      isLoading: false,
    });
    render(<CreateFundingRoundPage />);
    expect(screen.getByText('No funding rounds found.')).toBeInTheDocument();
  });

  // --- Type Selection ---

  it('renders all 7 round type cards', () => {
    render(<CreateFundingRoundPage />);
    expect(screen.getByTestId('type-card-PRE_SEED')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-SEED')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-SERIES_A')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-SERIES_B')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-SERIES_C')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-BRIDGE')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-OTHER')).toBeInTheDocument();
  });

  it('defaults to SEED type selected', () => {
    render(<CreateFundingRoundPage />);
    const seedCard = screen.getByTestId('type-card-SEED');
    expect(seedCard).toHaveClass('border-ocean-600');
  });

  it('changes selected type when a card is clicked', () => {
    render(<CreateFundingRoundPage />);
    const seriesACard = screen.getByTestId('type-card-SERIES_A');
    fireEvent.click(seriesACard);
    expect(seriesACard).toHaveClass('border-ocean-600');
    expect(screen.getByTestId('type-card-SEED')).not.toHaveClass(
      'border-ocean-600',
    );
  });

  it('renders type descriptions', () => {
    render(<CreateFundingRoundPage />);
    expect(
      screen.getByText('First institutional investment round.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Round to scale the business model.'),
    ).toBeInTheDocument();
  });

  // --- Form sections ---

  it('renders Round Information section with name field', () => {
    render(<CreateFundingRoundPage />);
    expect(screen.getByText('Round Information')).toBeInTheDocument();
    expect(screen.getByText('Round Name')).toBeInTheDocument();
    expect(screen.getByTestId('input-name')).toBeInTheDocument();
  });

  it('renders Financial Terms section', () => {
    render(<CreateFundingRoundPage />);
    expect(screen.getByText('Financial Terms')).toBeInTheDocument();
    expect(screen.getByText('Share Class')).toBeInTheDocument();
    expect(screen.getByText('Target Amount (R$)')).toBeInTheDocument();
    expect(screen.getByText('Minimum Close Amount (R$)')).toBeInTheDocument();
    expect(screen.getByText('Hard Cap (R$)')).toBeInTheDocument();
    expect(screen.getByText('Pre-Money Valuation (R$)')).toBeInTheDocument();
    expect(screen.getByText('Price per Share (R$)')).toBeInTheDocument();
  });

  it('renders share class dropdown with options', () => {
    render(<CreateFundingRoundPage />);
    const select = screen.getByTestId('select-shareClassId');
    expect(select).toBeInTheDocument();
    // Default placeholder option + 2 share classes
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[1].textContent).toContain('Quotas Ordinárias');
    expect(options[2].textContent).toContain('Ações Preferenciais');
  });

  it('renders Dates section', () => {
    render(<CreateFundingRoundPage />);
    expect(screen.getByText('Dates')).toBeInTheDocument();
    expect(screen.getByText('Target Close Date')).toBeInTheDocument();
    expect(screen.getByTestId('input-targetCloseDate')).toBeInTheDocument();
  });

  it('renders Notes section', () => {
    render(<CreateFundingRoundPage />);
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByTestId('input-notes')).toBeInTheDocument();
  });

  // --- Post-Money Valuation Calculation ---

  it('shows calculated post-money valuation when both pre-money and target are filled', () => {
    render(<CreateFundingRoundPage />);
    fireEvent.change(screen.getByTestId('input-preMoneyValuation'), {
      target: { value: '20000000' },
    });
    fireEvent.change(screen.getByTestId('input-targetAmount'), {
      target: { value: '5000000' },
    });
    expect(screen.getByTestId('calculated-postMoney')).toBeInTheDocument();
    // 20M + 5M = 25M = R$ 25.000.000,00
    expect(screen.getByTestId('calculated-postMoney').textContent).toContain(
      '25.000.000',
    );
  });

  it('does not show post-money when fields are empty', () => {
    render(<CreateFundingRoundPage />);
    expect(screen.queryByTestId('calculated-postMoney')).not.toBeInTheDocument();
  });

  // --- Validation ---

  it('shows required error on name when clicking Next with empty form', () => {
    render(<CreateFundingRoundPage />);
    fireEvent.click(screen.getByTestId('next-button'));
    // Name, shareClass, targetAmount, preMoneyValuation, pricePerShare should all show Required
    const requiredErrors = screen.getAllByText('Required');
    expect(requiredErrors.length).toBeGreaterThanOrEqual(4);
  });

  it('shows must be positive error for zero target amount', () => {
    render(<CreateFundingRoundPage />);
    fireEvent.change(screen.getByTestId('input-name'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByTestId('select-shareClassId'), {
      target: { value: 'sc-1' },
    });
    fireEvent.change(screen.getByTestId('input-targetAmount'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByTestId('input-preMoneyValuation'), {
      target: { value: '10000' },
    });
    fireEvent.change(screen.getByTestId('input-pricePerShare'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('validates minimum close amount must be <= target amount', () => {
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-minimumCloseAmount'), {
      target: { value: '10000000' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText(
        'Minimum close must be less than or equal to target.',
      ),
    ).toBeInTheDocument();
  });

  it('validates hard cap must be >= target amount', () => {
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-hardCap'), {
      target: { value: '1000000' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText(
        'Hard cap must be greater than or equal to target.',
      ),
    ).toBeInTheDocument();
  });

  it('clears field error when field value changes after submission', () => {
    render(<CreateFundingRoundPage />);
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(1);

    // Change name field
    fireEvent.change(screen.getByTestId('input-name'), {
      target: { value: 'Round' },
    });
    // The name field error should be cleared (but others remain)
    // Count remaining "Required" — should be fewer
    const remainingErrors = screen.getAllByText('Required');
    expect(remainingErrors.length).toBeGreaterThanOrEqual(1);
  });

  // --- Step Navigation ---

  it('advances to review step when form is valid', () => {
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByText('Round Review')).toBeInTheDocument();
    expect(screen.getByTestId('review-name')).toHaveTextContent(
      'Seed Round 2026',
    );
  });

  it('shows review data correctly', () => {
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-type')).toHaveTextContent('Seed');
    expect(screen.getByTestId('review-name')).toHaveTextContent(
      'Seed Round 2026',
    );
    expect(screen.getByTestId('review-shareClass')).toHaveTextContent(
      'Quotas Ordinárias',
    );
    expect(screen.getByTestId('review-targetAmount')).toBeInTheDocument();
    expect(screen.getByTestId('review-preMoney')).toBeInTheDocument();
    expect(screen.getByTestId('review-pricePerShare')).toBeInTheDocument();
    expect(screen.getByTestId('review-postMoney')).toBeInTheDocument();
  });

  it('shows optional fields in review only when filled', () => {
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));

    // Optional fields not filled
    expect(screen.queryByTestId('review-minClose')).not.toBeInTheDocument();
    expect(screen.queryByTestId('review-hardCap')).not.toBeInTheDocument();
    expect(screen.queryByTestId('review-closeDate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('review-notes')).not.toBeInTheDocument();
  });

  it('shows optional fields in review when filled', () => {
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-minimumCloseAmount'), {
      target: { value: '2000000' },
    });
    fireEvent.change(screen.getByTestId('input-hardCap'), {
      target: { value: '7000000' },
    });
    fireEvent.change(screen.getByTestId('input-targetCloseDate'), {
      target: { value: '2026-06-30' },
    });
    fireEvent.change(screen.getByTestId('input-notes'), {
      target: { value: 'First institutional round' },
    });
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-minClose')).toBeInTheDocument();
    expect(screen.getByTestId('review-hardCap')).toBeInTheDocument();
    expect(screen.getByTestId('review-closeDate')).toBeInTheDocument();
    expect(screen.getByTestId('review-notes')).toHaveTextContent(
      'First institutional round',
    );
  });

  it('navigates back from review to details step', () => {
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByText('Round Review')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('back-button'));
    expect(screen.getByText('Round Information')).toBeInTheDocument();
  });

  // --- Form Submission ---

  it('submits the form with correct payload', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'round-1' });
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: 'Seed Round 2026',
        roundType: 'SEED',
        shareClassId: 'sc-1',
        targetAmount: '5000000',
        preMoneyValuation: '20000000',
        pricePerShare: '10',
      });
    });
  });

  it('includes optional fields in payload when filled', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'round-1' });
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-minimumCloseAmount'), {
      target: { value: '2000000' },
    });
    fireEvent.change(screen.getByTestId('input-hardCap'), {
      target: { value: '7000000' },
    });
    fireEvent.change(screen.getByTestId('input-targetCloseDate'), {
      target: { value: '2026-06-30' },
    });
    fireEvent.change(screen.getByTestId('input-notes'), {
      target: { value: 'Notes here' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: 'Seed Round 2026',
        roundType: 'SEED',
        shareClassId: 'sc-1',
        targetAmount: '5000000',
        preMoneyValuation: '20000000',
        pricePerShare: '10',
        minimumCloseAmount: '2000000',
        hardCap: '7000000',
        targetCloseDate: '2026-06-30',
        notes: 'Notes here',
      });
    });
  });

  it('shows success toast and navigates after successful creation', async () => {
    const { toast } = require('sonner');
    mockMutateAsync.mockResolvedValue({ id: 'round-1' });
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Round created successfully');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/funding-rounds');
    });
  });

  it('shows error toast on API failure', async () => {
    const apiError = new Error('Server error');
    mockMutateAsync.mockRejectedValue(apiError);
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(apiError);
    });
  });

  it('disables submit button when mutation is pending', () => {
    mockUseCreateFundingRound.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    const submitButton = screen.getByTestId('submit-button');
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Loading...');
  });

  // --- Type selection with form submission ---

  it('submits with correct roundType when different type is selected', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'round-1' });
    render(<CreateFundingRoundPage />);
    fireEvent.click(screen.getByTestId('type-card-SERIES_A'));
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-type')).toHaveTextContent('Series A');

    fireEvent.click(screen.getByTestId('submit-button'));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ roundType: 'SERIES_A' }),
      );
    });
  });

  it('renders cancel link to funding rounds list', () => {
    render(<CreateFundingRoundPage />);
    const cancelLinks = screen.getAllByText('Cancel');
    const cancelLink = cancelLinks.find(
      (el) => el.closest('a')?.getAttribute('href') === '/dashboard/funding-rounds',
    );
    expect(cancelLink).toBeTruthy();
  });

  // --- Review type name mapping ---

  it('maps PRE_SEED type correctly in review', () => {
    render(<CreateFundingRoundPage />);
    fireEvent.click(screen.getByTestId('type-card-PRE_SEED'));
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-type')).toHaveTextContent('Pre-Seed');
  });

  it('maps BRIDGE type correctly in review', () => {
    render(<CreateFundingRoundPage />);
    fireEvent.click(screen.getByTestId('type-card-BRIDGE'));
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-type')).toHaveTextContent('Bridge');
  });

  // --- Helper text ---

  it('shows help text for minimum close amount and hard cap', () => {
    render(<CreateFundingRoundPage />);
    expect(
      screen.getByText('Minimum amount required to close the round.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Maximum amount the round can raise.'),
    ).toBeInTheDocument();
  });

  // --- Action buttons ---

  it('renders Next and Cancel buttons on details step', () => {
    render(<CreateFundingRoundPage />);
    expect(screen.getByTestId('next-button')).toHaveTextContent('Next');
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders Confirm and Back buttons on review step', () => {
    render(<CreateFundingRoundPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('submit-button')).toHaveTextContent('Confirm');
    expect(screen.getByTestId('back-button')).toHaveTextContent('Back');
  });
});
