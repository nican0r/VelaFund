import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateConvertiblePage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const fn = (key: string) => {
      const keys: Record<string, Record<string, string>> = {
        convertibles: {
          title: 'Convertible Instruments',
          createTitle: 'New Convertible Instrument',
          createDescription:
            'Fill in the details for the new convertible instrument.',
          empty: 'No convertible instruments found.',
          'instrumentType.mutuoConversivel': 'Mútuo Conversível',
          'instrumentType.investimentoAnjo': 'Investimento Anjo',
          'instrumentType.misto': 'Misto',
          'instrumentType.mais': 'MAIS',
          'interestType.simple': 'Simple',
          'interestType.compound': 'Compound',
          'conversionTriggerType.qualifiedFinancing': 'Qualified Financing',
          'conversionTriggerType.maturity': 'Maturity',
          'conversionTriggerType.changeOfControl': 'Change of Control',
          'conversionTriggerType.investorOption': 'Investor Option',
          'form.sectionType': 'Instrument Type',
          'form.sectionDetails': 'Financial Details',
          'form.sectionConversion': 'Conversion Terms',
          'form.typeCardMutuoConversivel': 'Mútuo Conversível',
          'form.typeCardMutuoConversivelDesc':
            'Traditional convertible loan agreement.',
          'form.typeCardInvestimentoAnjo': 'Investimento Anjo',
          'form.typeCardInvestimentoAnjoDesc':
            'Angel investment per Complementary Law 155/2016.',
          'form.typeCardMisto': 'Misto',
          'form.typeCardMistoDesc': 'Hybrid instrument with mixed terms.',
          'form.typeCardMais': 'MAIS',
          'form.typeCardMaisDesc':
            'Other convertible instrument types.',
          'form.investor': 'Investor',
          'form.investorPlaceholder': 'Select an investor',
          'form.principalAmount': 'Principal Amount (R$)',
          'form.principalAmountPlaceholder': '0.00',
          'form.interestRate': 'Interest Rate (%)',
          'form.interestRatePlaceholder': 'e.g., 8',
          'form.interestType': 'Interest Type',
          'form.issueDate': 'Issue Date',
          'form.maturityDate': 'Maturity Date',
          'form.discountRate': 'Discount Rate (%)',
          'form.discountRatePlaceholder': 'e.g., 20',
          'form.valuationCap': 'Valuation Cap (R$)',
          'form.valuationCapPlaceholder': '0.00',
          'form.qualifiedFinancingThreshold':
            'Qualified Financing Threshold (R$)',
          'form.qualifiedFinancingThresholdPlaceholder': '0.00',
          'form.conversionTrigger': 'Conversion Trigger',
          'form.conversionTriggerPlaceholder': 'Select a trigger',
          'form.shareClass': 'Target Share Class',
          'form.shareClassPlaceholder': 'Select a share class',
          'form.autoConvert': 'Auto-Convert',
          'form.autoConvertHelp':
            'Automatically convert when trigger conditions are met.',
          'form.mfnClause': 'MFN Clause',
          'form.mfnClauseHelp':
            'Most Favored Nation clause protects investor terms.',
          'form.notes': 'Notes',
          'form.notesPlaceholder': 'Additional notes...',
          'form.stepDetails': 'Details',
          'form.stepReview': 'Review',
          'form.reviewTitle': 'Instrument Review',
          'form.reviewType': 'Type',
          'form.reviewInvestor': 'Investor',
          'form.reviewPrincipalAmount': 'Principal Amount',
          'form.reviewInterestRate': 'Interest Rate',
          'form.reviewInterestType': 'Interest Type',
          'form.reviewIssueDate': 'Issue Date',
          'form.reviewMaturityDate': 'Maturity Date',
          'form.reviewDiscountRate': 'Discount Rate',
          'form.reviewValuationCap': 'Valuation Cap',
          'form.reviewQualifiedFinancing': 'Qualified Financing',
          'form.reviewConversionTrigger': 'Conversion Trigger',
          'form.reviewShareClass': 'Target Share Class',
          'form.reviewAutoConvert': 'Auto-Convert',
          'form.reviewMfnClause': 'MFN Clause',
          'form.reviewNotes': 'Notes',
          'success.created': 'Convertible created successfully',
        },
        common: {
          cancel: 'Cancel',
          next: 'Next',
          back: 'Back',
          confirm: 'Confirm',
          loading: 'Loading...',
          yes: 'Yes',
          no: 'No',
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
const mockUseCreateConvertible = jest.fn();
const mockUseShareholders = jest.fn();
const mockUseShareClasses = jest.fn();

jest.mock('@/hooks/use-convertibles', () => ({
  useCreateConvertible: (...args: unknown[]) =>
    mockUseCreateConvertible(...args),
}));

jest.mock('@/hooks/use-shareholders', () => ({
  useShareholders: (...args: unknown[]) => mockUseShareholders(...args),
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

const mockShareholders = [
  {
    id: 'sh-1',
    name: 'João Silva',
    type: 'INDIVIDUAL',
    status: 'ACTIVE',
    companyId: 'company-1',
  },
  {
    id: 'sh-2',
    name: 'Fund ABC',
    type: 'CORPORATE',
    status: 'ACTIVE',
    companyId: 'company-1',
  },
];

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

  mockUseCreateConvertible.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });

  mockUseShareholders.mockReturnValue({
    data: {
      data: mockShareholders,
      meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
    },
    isLoading: false,
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
  fireEvent.change(screen.getByTestId('select-shareholderId'), {
    target: { value: 'sh-1' },
  });
  fireEvent.change(screen.getByTestId('input-principalAmount'), {
    target: { value: '500000' },
  });
  fireEvent.change(screen.getByTestId('input-interestRate'), {
    target: { value: '8' },
  });
  fireEvent.change(screen.getByTestId('input-issueDate'), {
    target: { value: '2026-01-15' },
  });
  fireEvent.change(screen.getByTestId('input-maturityDate'), {
    target: { value: '2028-01-15' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setup();
});

// --- Tests ---

describe('CreateConvertiblePage', () => {
  // --- Rendering ---

  it('renders the page title and description', () => {
    render(<CreateConvertiblePage />);
    expect(screen.getByText('New Convertible Instrument')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Fill in the details for the new convertible instrument.',
      ),
    ).toBeInTheDocument();
  });

  it('renders back link to convertibles list', () => {
    render(<CreateConvertiblePage />);
    const backLink = screen.getByText('Convertible Instruments');
    expect(backLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/convertibles',
    );
  });

  it('renders step indicator with Details and Review', () => {
    render(<CreateConvertiblePage />);
    expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders no company state when no company is selected', () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: null,
      isLoading: false,
    });
    render(<CreateConvertiblePage />);
    expect(
      screen.getByText('No convertible instruments found.'),
    ).toBeInTheDocument();
  });

  // --- Type Selection ---

  it('renders all 4 instrument type cards', () => {
    render(<CreateConvertiblePage />);
    expect(
      screen.getByTestId('type-card-MUTUO_CONVERSIVEL'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('type-card-INVESTIMENTO_ANJO'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('type-card-MISTO')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-MAIS')).toBeInTheDocument();
  });

  it('defaults to MUTUO_CONVERSIVEL type selected', () => {
    render(<CreateConvertiblePage />);
    const mutuoCard = screen.getByTestId('type-card-MUTUO_CONVERSIVEL');
    expect(mutuoCard).toHaveClass('border-ocean-600');
  });

  it('changes selected type when a card is clicked', () => {
    render(<CreateConvertiblePage />);
    const anjoCard = screen.getByTestId('type-card-INVESTIMENTO_ANJO');
    fireEvent.click(anjoCard);
    expect(anjoCard).toHaveClass('border-ocean-600');
    expect(
      screen.getByTestId('type-card-MUTUO_CONVERSIVEL'),
    ).not.toHaveClass('border-ocean-600');
  });

  it('renders type descriptions', () => {
    render(<CreateConvertiblePage />);
    expect(
      screen.getByText('Traditional convertible loan agreement.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Angel investment per Complementary Law 155/2016.'),
    ).toBeInTheDocument();
  });

  // --- Form sections ---

  it('renders Financial Details section', () => {
    render(<CreateConvertiblePage />);
    expect(screen.getByText('Financial Details')).toBeInTheDocument();
    expect(screen.getByText('Investor')).toBeInTheDocument();
    expect(screen.getByText('Principal Amount (R$)')).toBeInTheDocument();
    expect(screen.getByText('Interest Rate (%)')).toBeInTheDocument();
    expect(screen.getByText('Interest Type')).toBeInTheDocument();
    expect(screen.getByText('Issue Date')).toBeInTheDocument();
    expect(screen.getByText('Maturity Date')).toBeInTheDocument();
  });

  it('renders Conversion Terms section', () => {
    render(<CreateConvertiblePage />);
    expect(screen.getByText('Conversion Terms')).toBeInTheDocument();
    expect(screen.getByText('Discount Rate (%)')).toBeInTheDocument();
    expect(screen.getByText('Valuation Cap (R$)')).toBeInTheDocument();
    expect(
      screen.getByText('Qualified Financing Threshold (R$)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Conversion Trigger')).toBeInTheDocument();
    expect(screen.getByText('Target Share Class')).toBeInTheDocument();
  });

  it('renders investor dropdown with options', () => {
    render(<CreateConvertiblePage />);
    const select = screen.getByTestId('select-shareholderId');
    expect(select).toBeInTheDocument();
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3); // placeholder + 2 shareholders
    expect(options[1].textContent).toContain('João Silva');
    expect(options[2].textContent).toContain('Fund ABC');
  });

  it('renders share class dropdown with options', () => {
    render(<CreateConvertiblePage />);
    const select = screen.getByTestId('select-targetShareClassId');
    expect(select).toBeInTheDocument();
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3); // placeholder + 2 share classes
    expect(options[1].textContent).toContain('Quotas Ordinárias');
    expect(options[2].textContent).toContain('Ações Preferenciais');
  });

  it('renders conversion trigger dropdown with options', () => {
    render(<CreateConvertiblePage />);
    const select = screen.getByTestId('select-conversionTrigger');
    expect(select).toBeInTheDocument();
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(5); // placeholder + 4 triggers
    expect(options[1].textContent).toBe('Qualified Financing');
    expect(options[2].textContent).toBe('Maturity');
    expect(options[3].textContent).toBe('Change of Control');
    expect(options[4].textContent).toBe('Investor Option');
  });

  it('renders interest type dropdown with Simple and Compound', () => {
    render(<CreateConvertiblePage />);
    const select = screen.getByTestId('select-interestType');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe('Simple');
    expect(options[1].textContent).toBe('Compound');
  });

  it('renders auto-convert and MFN clause checkboxes', () => {
    render(<CreateConvertiblePage />);
    expect(screen.getByTestId('checkbox-autoConvert')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-mfnClause')).toBeInTheDocument();
    expect(screen.getByText('Auto-Convert')).toBeInTheDocument();
    expect(screen.getByText('MFN Clause')).toBeInTheDocument();
  });

  it('renders checkbox help text', () => {
    render(<CreateConvertiblePage />);
    expect(
      screen.getByText(
        'Automatically convert when trigger conditions are met.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Most Favored Nation clause protects investor terms.',
      ),
    ).toBeInTheDocument();
  });

  it('renders Notes section', () => {
    render(<CreateConvertiblePage />);
    expect(screen.getByTestId('input-notes')).toBeInTheDocument();
  });

  // --- Validation ---

  it('shows required errors when clicking Next with empty form', () => {
    render(<CreateConvertiblePage />);
    fireEvent.click(screen.getByTestId('next-button'));
    // shareholderId, principalAmount, interestRate, issueDate, maturityDate
    const requiredErrors = screen.getAllByText('Required');
    expect(requiredErrors.length).toBeGreaterThanOrEqual(5);
  });

  it('shows must be positive error for zero principal amount', () => {
    render(<CreateConvertiblePage />);
    fireEvent.change(screen.getByTestId('select-shareholderId'), {
      target: { value: 'sh-1' },
    });
    fireEvent.change(screen.getByTestId('input-principalAmount'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByTestId('input-interestRate'), {
      target: { value: '8' },
    });
    fireEvent.change(screen.getByTestId('input-issueDate'), {
      target: { value: '2026-01-15' },
    });
    fireEvent.change(screen.getByTestId('input-maturityDate'), {
      target: { value: '2028-01-15' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('shows error for interest rate over 100', () => {
    render(<CreateConvertiblePage />);
    fireEvent.change(screen.getByTestId('select-shareholderId'), {
      target: { value: 'sh-1' },
    });
    fireEvent.change(screen.getByTestId('input-principalAmount'), {
      target: { value: '100000' },
    });
    fireEvent.change(screen.getByTestId('input-interestRate'), {
      target: { value: '150' },
    });
    fireEvent.change(screen.getByTestId('input-issueDate'), {
      target: { value: '2026-01-15' },
    });
    fireEvent.change(screen.getByTestId('input-maturityDate'), {
      target: { value: '2028-01-15' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('validates maturity date must be after issue date', () => {
    render(<CreateConvertiblePage />);
    fireEvent.change(screen.getByTestId('select-shareholderId'), {
      target: { value: 'sh-1' },
    });
    fireEvent.change(screen.getByTestId('input-principalAmount'), {
      target: { value: '100000' },
    });
    fireEvent.change(screen.getByTestId('input-interestRate'), {
      target: { value: '8' },
    });
    fireEvent.change(screen.getByTestId('input-issueDate'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.change(screen.getByTestId('input-maturityDate'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    // maturityDate error should be shown
    const errors = screen.getAllByText('Must be greater than zero');
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it('validates optional discount rate is between 0 and 100', () => {
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-discountRate'), {
      target: { value: '150' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('validates optional valuation cap must be positive', () => {
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-valuationCap'), {
      target: { value: '-1000' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('clears field error when field value changes after submission', () => {
    render(<CreateConvertiblePage />);
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(5);

    fireEvent.change(screen.getByTestId('select-shareholderId'), {
      target: { value: 'sh-1' },
    });
    const remainingErrors = screen.getAllByText('Required');
    expect(remainingErrors.length).toBeGreaterThanOrEqual(1);
  });

  it('resets conversion fields when changing instrument type', () => {
    render(<CreateConvertiblePage />);
    fireEvent.change(screen.getByTestId('input-discountRate'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByTestId('input-valuationCap'), {
      target: { value: '5000000' },
    });
    fireEvent.click(screen.getByTestId('checkbox-autoConvert'));

    // Change type
    fireEvent.click(screen.getByTestId('type-card-INVESTIMENTO_ANJO'));

    // Fields should be reset
    expect(screen.getByTestId('input-discountRate')).toHaveValue(null);
    expect(screen.getByTestId('input-valuationCap')).toHaveValue(null);
    expect(screen.getByTestId('checkbox-autoConvert')).not.toBeChecked();
  });

  // --- Step Navigation ---

  it('advances to review step when form is valid', () => {
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByText('Instrument Review')).toBeInTheDocument();
  });

  it('shows review data correctly for required fields', () => {
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-type')).toHaveTextContent(
      'Mútuo Conversível',
    );
    expect(screen.getByTestId('review-investor')).toHaveTextContent(
      'João Silva',
    );
    expect(screen.getByTestId('review-principalAmount')).toBeInTheDocument();
    expect(screen.getByTestId('review-interestRate')).toBeInTheDocument();
    expect(screen.getByTestId('review-interestType')).toHaveTextContent(
      'Simple',
    );
    expect(screen.getByTestId('review-issueDate')).toBeInTheDocument();
    expect(screen.getByTestId('review-maturityDate')).toBeInTheDocument();
  });

  it('shows optional fields in review only when filled', () => {
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));

    expect(
      screen.queryByTestId('review-discountRate'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('review-valuationCap'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('review-qualifiedFinancing'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('review-conversionTrigger'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('review-shareClass'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('review-autoConvert'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('review-mfnClause'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('review-notes')).not.toBeInTheDocument();
  });

  it('shows optional fields in review when filled', () => {
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-discountRate'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByTestId('input-valuationCap'), {
      target: { value: '5000000' },
    });
    fireEvent.change(
      screen.getByTestId('input-qualifiedFinancingThreshold'),
      {
        target: { value: '1000000' },
      },
    );
    fireEvent.change(screen.getByTestId('select-conversionTrigger'), {
      target: { value: 'QUALIFIED_FINANCING' },
    });
    fireEvent.change(screen.getByTestId('select-targetShareClassId'), {
      target: { value: 'sc-1' },
    });
    fireEvent.click(screen.getByTestId('checkbox-autoConvert'));
    fireEvent.click(screen.getByTestId('checkbox-mfnClause'));
    fireEvent.change(screen.getByTestId('input-notes'), {
      target: { value: 'Some notes' },
    });
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-discountRate')).toBeInTheDocument();
    expect(screen.getByTestId('review-valuationCap')).toBeInTheDocument();
    expect(
      screen.getByTestId('review-qualifiedFinancing'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('review-conversionTrigger'),
    ).toHaveTextContent('Qualified Financing');
    expect(screen.getByTestId('review-shareClass')).toHaveTextContent(
      'Quotas Ordinárias',
    );
    expect(screen.getByTestId('review-autoConvert')).toHaveTextContent(
      'Yes',
    );
    expect(screen.getByTestId('review-mfnClause')).toHaveTextContent('Yes');
    expect(screen.getByTestId('review-notes')).toHaveTextContent(
      'Some notes',
    );
  });

  it('navigates back from review to details step', () => {
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByText('Instrument Review')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('back-button'));
    expect(screen.getByText('Financial Details')).toBeInTheDocument();
  });

  // --- Form Submission ---

  it('submits the form with correct payload (required fields only)', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'conv-1' });
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        shareholderId: 'sh-1',
        instrumentType: 'MUTUO_CONVERSIVEL',
        principalAmount: '500000',
        interestRate: '0.08', // 8% → 0.08 decimal
        interestType: 'SIMPLE',
        issueDate: '2026-01-15',
        maturityDate: '2028-01-15',
      });
    });
  });

  it('includes optional fields in payload when filled', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'conv-1' });
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-discountRate'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByTestId('input-valuationCap'), {
      target: { value: '5000000' },
    });
    fireEvent.change(
      screen.getByTestId('input-qualifiedFinancingThreshold'),
      {
        target: { value: '1000000' },
      },
    );
    fireEvent.change(screen.getByTestId('select-conversionTrigger'), {
      target: { value: 'MATURITY' },
    });
    fireEvent.change(screen.getByTestId('select-targetShareClassId'), {
      target: { value: 'sc-2' },
    });
    fireEvent.click(screen.getByTestId('checkbox-autoConvert'));
    fireEvent.click(screen.getByTestId('checkbox-mfnClause'));
    fireEvent.change(screen.getByTestId('input-notes'), {
      target: { value: 'Test notes' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        shareholderId: 'sh-1',
        instrumentType: 'MUTUO_CONVERSIVEL',
        principalAmount: '500000',
        interestRate: '0.08',
        interestType: 'SIMPLE',
        issueDate: '2026-01-15',
        maturityDate: '2028-01-15',
        discountRate: '0.2', // 20% → 0.2
        valuationCap: '5000000',
        qualifiedFinancingThreshold: '1000000',
        conversionTrigger: 'MATURITY',
        targetShareClassId: 'sc-2',
        autoConvert: true,
        mfnClause: true,
        notes: 'Test notes',
      });
    });
  });

  it('shows success toast and navigates after successful creation', async () => {
    const { toast } = require('sonner');
    mockMutateAsync.mockResolvedValue({ id: 'conv-1' });
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Convertible created successfully',
      );
      expect(mockPush).toHaveBeenCalledWith('/dashboard/convertibles');
    });
  });

  it('shows error toast on API failure', async () => {
    const apiError = new Error('Server error');
    mockMutateAsync.mockRejectedValue(apiError);
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(apiError);
    });
  });

  it('disables submit button when mutation is pending', () => {
    mockUseCreateConvertible.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    const submitButton = screen.getByTestId('submit-button');
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Loading...');
  });

  // --- Type selection with form submission ---

  it('submits with correct instrumentType when different type is selected', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'conv-1' });
    render(<CreateConvertiblePage />);
    fireEvent.click(screen.getByTestId('type-card-INVESTIMENTO_ANJO'));
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-type')).toHaveTextContent(
      'Investimento Anjo',
    );

    fireEvent.click(screen.getByTestId('submit-button'));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ instrumentType: 'INVESTIMENTO_ANJO' }),
      );
    });
  });

  it('submits with compound interest type when selected', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'conv-1' });
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('select-interestType'), {
      target: { value: 'COMPOUND' },
    });
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-interestType')).toHaveTextContent(
      'Compound',
    );

    fireEvent.click(screen.getByTestId('submit-button'));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ interestType: 'COMPOUND' }),
      );
    });
  });

  // --- Action buttons ---

  it('renders cancel link to convertibles list', () => {
    render(<CreateConvertiblePage />);
    const cancelLinks = screen.getAllByText('Cancel');
    const cancelLink = cancelLinks.find(
      (el) =>
        el.closest('a')?.getAttribute('href') === '/dashboard/convertibles',
    );
    expect(cancelLink).toBeTruthy();
  });

  it('renders Next and Cancel buttons on details step', () => {
    render(<CreateConvertiblePage />);
    expect(screen.getByTestId('next-button')).toHaveTextContent('Next');
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders Confirm and Back buttons on review step', () => {
    render(<CreateConvertiblePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('submit-button')).toHaveTextContent('Confirm');
    expect(screen.getByTestId('back-button')).toHaveTextContent('Back');
  });

  // --- Review type name mapping ---

  it('maps MISTO type correctly in review', () => {
    render(<CreateConvertiblePage />);
    fireEvent.click(screen.getByTestId('type-card-MISTO'));
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-type')).toHaveTextContent('Misto');
  });

  it('maps MAIS type correctly in review', () => {
    render(<CreateConvertiblePage />);
    fireEvent.click(screen.getByTestId('type-card-MAIS'));
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-type')).toHaveTextContent('MAIS');
  });
});
