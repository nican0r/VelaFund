import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateOptionGrantPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const fn = (key: string, params?: Record<string, unknown>) => {
      const keys: Record<string, Record<string, string>> = {
        optionPlans: {
          title: 'Option Plans',
          empty: 'No option plans found.',
          'grantForm.createTitle': 'Create Option Grant',
          'grantForm.createDescription':
            'Configure a new option grant for an employee.',
          'grantForm.sectionEmployee': 'Employee Information',
          'grantForm.sectionTerms': 'Grant Terms',
          'grantForm.sectionVesting': 'Vesting Configuration',
          'grantForm.employeeName': 'Employee Name',
          'grantForm.employeeNamePlaceholder': 'e.g., John Smith',
          'grantForm.employeeEmail': 'Employee Email',
          'grantForm.employeeEmailPlaceholder': 'e.g., employee@company.com',
          'grantForm.shareholder': 'Linked Shareholder',
          'grantForm.shareholderNone': 'None (link later)',
          'grantForm.shareholderHelp':
            'Optional. Link this grant to an existing shareholder.',
          'grantForm.optionPlan': 'Option Plan',
          'grantForm.optionPlanPlaceholder': 'Select a plan',
          'grantForm.availableOptions': `${params?.count ?? 0} options available in the plan`,
          'grantForm.quantity': 'Option Quantity',
          'grantForm.quantityPlaceholder': 'e.g., 10000',
          'grantForm.strikePrice': 'Strike Price',
          'grantForm.strikePricePlaceholder': 'e.g., 1.00',
          'grantForm.strikePriceHelp':
            'Price per option the employee will pay to exercise.',
          'grantForm.grantDate': 'Grant Date',
          'grantForm.grantDateHelp':
            'Date when the options are granted to the employee.',
          'grantForm.expirationDate': 'Expiration Date',
          'grantForm.expirationDateHelp':
            'Date when the options expire if not exercised.',
          'grantForm.cliffMonths': 'Cliff (months)',
          'grantForm.cliffMonthsPlaceholder': 'e.g., 12',
          'grantForm.cliffMonthsHelp':
            'Period before any options vest. Cannot exceed the vesting duration.',
          'grantForm.vestingDurationMonths': 'Vesting Period (months)',
          'grantForm.vestingDurationMonthsPlaceholder': 'e.g., 48',
          'grantForm.vestingDurationMonthsHelp':
            'Total vesting duration in months.',
          'grantForm.vestingFrequency': 'Vesting Frequency',
          'grantForm.vestingFrequencyHelp':
            'How often options will vest after the cliff.',
          'grantForm.accelerationOnCoc': 'Acceleration on Change of Control',
          'grantForm.accelerationOnCocHelp':
            'If enabled, all options will vest immediately upon a change of control event.',
          'grantForm.notes': 'Notes',
          'grantForm.notesPlaceholder': 'Additional notes about the grant...',
          'grantForm.stepDetails': 'Details',
          'grantForm.stepReview': 'Review',
          'grantForm.reviewTitle': 'Grant Summary',
          'grantForm.reviewEmployeeName': 'Employee',
          'grantForm.reviewEmployeeEmail': 'Email',
          'grantForm.reviewShareholder': 'Linked Shareholder',
          'grantForm.reviewOptionPlan': 'Plan',
          'grantForm.reviewQuantity': 'Quantity',
          'grantForm.reviewStrikePrice': 'Strike Price',
          'grantForm.reviewTotalValue': 'Total Value',
          'grantForm.reviewGrantDate': 'Grant Date',
          'grantForm.reviewExpirationDate': 'Expiration',
          'grantForm.reviewCliffMonths': 'Cliff',
          'grantForm.reviewCliffMonthsSuffix': 'months',
          'grantForm.reviewVestingDuration': 'Vesting Period',
          'grantForm.reviewVestingDurationSuffix': 'months',
          'grantForm.reviewVestingFrequency': 'Vesting Frequency',
          'grantForm.reviewAccelerationOnCoc':
            'Change of Control Acceleration',
          'grantForm.reviewNotes': 'Notes',
          'frequency.monthly': 'Monthly',
          'frequency.quarterly': 'Quarterly',
          'frequency.annually': 'Annually',
          'success.grantCreated': 'Option grant created successfully',
        },
        common: {
          cancel: 'Cancel',
          next: 'Next',
          back: 'Back',
          confirm: 'Confirm',
          loading: 'Loading...',
          yes: 'Yes',
        },
        errors: {
          'val.required': 'Required',
          'val.mustBePositive': 'Must be greater than zero',
          'val.maxValue': 'Exceeds maximum allowed value',
          'val.invalidEmail': 'Invalid email',
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
const mockUseCreateOptionGrant = jest.fn();
const mockUseOptionPlans = jest.fn();
const mockUseShareholders = jest.fn();

jest.mock('@/hooks/use-option-plans', () => ({
  useCreateOptionGrant: (...args: unknown[]) =>
    mockUseCreateOptionGrant(...args),
  useOptionPlans: (...args: unknown[]) => mockUseOptionPlans(...args),
}));

jest.mock('@/hooks/use-shareholders', () => ({
  useShareholders: (...args: unknown[]) => mockUseShareholders(...args),
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

const mockPlans = [
  {
    id: 'plan-1',
    name: 'ESOP 2026',
    companyId: 'company-1',
    totalPoolSize: '100000',
    totalGranted: '30000',
    status: 'ACTIVE',
    shareClass: { id: 'sc-1', className: 'ON', type: 'COMMON_SHARES' },
  },
  {
    id: 'plan-2',
    name: 'Advisory Pool',
    companyId: 'company-1',
    totalPoolSize: '50000',
    totalGranted: '10000',
    status: 'ACTIVE',
    shareClass: { id: 'sc-2', className: 'PN', type: 'PREFERRED_SHARES' },
  },
];

const mockShareholders = [
  {
    id: 'sh-1',
    name: 'João da Silva',
    type: 'INDIVIDUAL',
    status: 'ACTIVE',
    companyId: 'company-1',
  },
  {
    id: 'sh-2',
    name: 'Maria Santos',
    type: 'INDIVIDUAL',
    status: 'ACTIVE',
    companyId: 'company-1',
  },
];

// --- Setup ---

function setup() {
  mockUseCompany.mockReturnValue({
    selectedCompany: mockCompany,
    isLoading: false,
  });

  mockUseCreateOptionGrant.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });

  mockUseOptionPlans.mockReturnValue({
    data: {
      data: mockPlans,
      meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
    },
    isLoading: false,
  });

  mockUseShareholders.mockReturnValue({
    data: {
      data: mockShareholders,
      meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
    },
    isLoading: false,
  });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByTestId('input-employeeName'), {
    target: { value: 'João da Silva' },
  });
  fireEvent.change(screen.getByTestId('input-employeeEmail'), {
    target: { value: 'joao@company.com' },
  });
  fireEvent.change(screen.getByTestId('select-optionPlanId'), {
    target: { value: 'plan-1' },
  });
  fireEvent.change(screen.getByTestId('input-quantity'), {
    target: { value: '10000' },
  });
  fireEvent.change(screen.getByTestId('input-strikePrice'), {
    target: { value: '5.00' },
  });
  fireEvent.change(screen.getByTestId('input-grantDate'), {
    target: { value: '2026-03-01' },
  });
  fireEvent.change(screen.getByTestId('input-expirationDate'), {
    target: { value: '2036-03-01' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setup();
});

// --- Tests ---

describe('CreateOptionGrantPage', () => {
  // --- Rendering ---

  it('renders the page title and description', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByText('Create Option Grant')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Configure a new option grant for an employee.',
      ),
    ).toBeInTheDocument();
  });

  it('renders back link to option plans list', () => {
    render(<CreateOptionGrantPage />);
    const backLink = screen.getByText('Option Plans');
    expect(backLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/options',
    );
  });

  it('renders step indicator with Details and Review', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders no company state when no company is selected', () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: null,
      isLoading: false,
    });
    render(<CreateOptionGrantPage />);
    expect(
      screen.getByText('No option plans found.'),
    ).toBeInTheDocument();
  });

  // --- Employee Section ---

  it('renders Employee Information section with name, email, and shareholder', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByText('Employee Information')).toBeInTheDocument();
    expect(screen.getByText('Employee Name')).toBeInTheDocument();
    expect(screen.getByTestId('input-employeeName')).toBeInTheDocument();
    expect(screen.getByText('Employee Email')).toBeInTheDocument();
    expect(screen.getByTestId('input-employeeEmail')).toBeInTheDocument();
    expect(screen.getByText('Linked Shareholder')).toBeInTheDocument();
    expect(
      screen.getByTestId('select-shareholderId'),
    ).toBeInTheDocument();
  });

  it('renders shareholder dropdown with None option and shareholders', () => {
    render(<CreateOptionGrantPage />);
    const select = screen.getByTestId('select-shareholderId');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3); // None + 2 shareholders
    expect(options[0].textContent).toBe('None (link later)');
    expect(options[1].textContent).toBe('João da Silva');
    expect(options[2].textContent).toBe('Maria Santos');
  });

  it('renders shareholder help text', () => {
    render(<CreateOptionGrantPage />);
    expect(
      screen.getByText(
        'Optional. Link this grant to an existing shareholder.',
      ),
    ).toBeInTheDocument();
  });

  // --- Grant Terms Section ---

  it('renders Grant Terms section with plan dropdown', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByText('Grant Terms')).toBeInTheDocument();
    expect(screen.getByText('Option Plan')).toBeInTheDocument();
    expect(
      screen.getByTestId('select-optionPlanId'),
    ).toBeInTheDocument();
  });

  it('renders option plan dropdown with active plans', () => {
    render(<CreateOptionGrantPage />);
    const select = screen.getByTestId('select-optionPlanId');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3); // placeholder + 2 plans
    expect(options[1].textContent).toBe('ESOP 2026');
    expect(options[2].textContent).toBe('Advisory Pool');
  });

  it('shows available options when a plan is selected', () => {
    render(<CreateOptionGrantPage />);
    fireEvent.change(screen.getByTestId('select-optionPlanId'), {
      target: { value: 'plan-1' },
    });
    expect(screen.getByTestId('available-options')).toBeInTheDocument();
    // plan-1 has 100000 total - 30000 granted = 70000 available
    expect(screen.getByTestId('available-options').textContent).toContain(
      '70.000',
    );
  });

  it('renders quantity and strike price fields', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByText('Option Quantity')).toBeInTheDocument();
    expect(screen.getByTestId('input-quantity')).toBeInTheDocument();
    expect(screen.getByText('Strike Price')).toBeInTheDocument();
    expect(screen.getByTestId('input-strikePrice')).toBeInTheDocument();
  });

  it('shows calculated total value when quantity and strike price are filled', () => {
    render(<CreateOptionGrantPage />);
    fireEvent.change(screen.getByTestId('input-quantity'), {
      target: { value: '10000' },
    });
    fireEvent.change(screen.getByTestId('input-strikePrice'), {
      target: { value: '5.00' },
    });
    const totalValueEl = screen.getByTestId('calculated-totalValue');
    expect(totalValueEl).toBeInTheDocument();
    // 10000 * 5 = 50000 → R$ 50.000,00
    expect(totalValueEl.textContent).toContain('R$');
  });

  it('renders date fields for grant and expiration', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByText('Grant Date')).toBeInTheDocument();
    expect(screen.getByTestId('input-grantDate')).toBeInTheDocument();
    expect(screen.getByText('Expiration Date')).toBeInTheDocument();
    expect(
      screen.getByTestId('input-expirationDate'),
    ).toBeInTheDocument();
  });

  // --- Vesting Section ---

  it('renders Vesting Configuration section', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByText('Vesting Configuration')).toBeInTheDocument();
    expect(screen.getByText('Cliff (months)')).toBeInTheDocument();
    expect(screen.getByTestId('input-cliffMonths')).toBeInTheDocument();
    expect(
      screen.getByText('Vesting Period (months)'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('input-vestingDurationMonths'),
    ).toBeInTheDocument();
  });

  it('renders default cliff of 12 months', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByTestId('input-cliffMonths')).toHaveValue(12);
  });

  it('renders default vesting duration of 48 months', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByTestId('input-vestingDurationMonths')).toHaveValue(
      48,
    );
  });

  it('renders vesting frequency dropdown with MONTHLY default', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByText('Vesting Frequency')).toBeInTheDocument();
    const select = screen.getByTestId('select-vestingFrequency');
    expect(select).toHaveValue('MONTHLY');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe('Monthly');
    expect(options[1].textContent).toBe('Quarterly');
    expect(options[2].textContent).toBe('Annually');
  });

  it('renders acceleration on change of control checkbox', () => {
    render(<CreateOptionGrantPage />);
    expect(
      screen.getByText('Acceleration on Change of Control'),
    ).toBeInTheDocument();
    const checkbox = screen.getByTestId('checkbox-accelerationOnCoc');
    expect(checkbox).not.toBeChecked();
  });

  it('renders notes textarea', () => {
    render(<CreateOptionGrantPage />);
    expect(screen.getByTestId('input-notes')).toBeInTheDocument();
  });

  // --- Validation ---

  it('shows required errors when Next is clicked with empty form', () => {
    render(<CreateOptionGrantPage />);
    fireEvent.click(screen.getByTestId('next-button'));
    // Should show errors for required fields
    const errors = screen.getAllByText('Required');
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it('shows invalid email error for bad email format', () => {
    render(<CreateOptionGrantPage />);
    fireEvent.change(screen.getByTestId('input-employeeName'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByTestId('input-employeeEmail'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('shows error when quantity is zero or negative', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-quantity'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('shows error when quantity exceeds available options', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    // plan-1 has 70000 available, request 80000
    fireEvent.change(screen.getByTestId('input-quantity'), {
      target: { value: '80000' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Exceeds maximum allowed value'),
    ).toBeInTheDocument();
  });

  it('shows error when strike price is zero', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-strikePrice'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('shows error when expiration date is before grant date', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-grantDate'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.change(screen.getByTestId('input-expirationDate'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('shows error when cliff exceeds vesting duration', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-cliffMonths'), {
      target: { value: '60' },
    });
    fireEvent.change(screen.getByTestId('input-vestingDurationMonths'), {
      target: { value: '48' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Exceeds maximum allowed value'),
    ).toBeInTheDocument();
  });

  it('shows error when vesting duration is zero', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-vestingDurationMonths'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByText('Must be greater than zero'),
    ).toBeInTheDocument();
  });

  it('clears field error when the field is updated after submission', () => {
    render(<CreateOptionGrantPage />);
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(
      1,
    );
    // Fix one field
    fireEvent.change(screen.getByTestId('input-employeeName'), {
      target: { value: 'Test Name' },
    });
    // The employeeName error should be cleared
    const nameInput = screen
      .getByTestId('input-employeeName')
      .closest('div');
    expect(nameInput?.querySelector('.text-red-600')).toBeNull();
  });

  // --- Step Navigation ---

  it('advances to review step when form is valid', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByText('Grant Summary')).toBeInTheDocument();
    expect(screen.getByTestId('review-employeeName')).toBeInTheDocument();
  });

  it('goes back to details step when Back is clicked', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByText('Grant Summary')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('back-button'));
    expect(screen.getByText('Employee Information')).toBeInTheDocument();
  });

  // --- Review Step ---

  it('displays all required fields in review', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-employeeName').textContent).toBe(
      'João da Silva',
    );
    expect(screen.getByTestId('review-employeeEmail').textContent).toBe(
      'joao@company.com',
    );
    expect(screen.getByTestId('review-optionPlan').textContent).toBe(
      'ESOP 2026',
    );
    expect(screen.getByTestId('review-quantity')).toBeInTheDocument();
    expect(screen.getByTestId('review-strikePrice')).toBeInTheDocument();
    expect(screen.getByTestId('review-totalValue')).toBeInTheDocument();
    expect(screen.getByTestId('review-grantDate')).toBeInTheDocument();
    expect(
      screen.getByTestId('review-expirationDate'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('review-cliffMonths')).toBeInTheDocument();
    expect(
      screen.getByTestId('review-vestingDuration'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('review-vestingFrequency'),
    ).toBeInTheDocument();
  });

  it('displays formatted quantity in review', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    // 10000 formatted pt-BR = 10.000
    expect(screen.getByTestId('review-quantity').textContent).toBe(
      '10.000',
    );
  });

  it('displays vesting frequency label in review', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByTestId('review-vestingFrequency').textContent,
    ).toBe('Monthly');
  });

  it('shows acceleration on CoC in review when checked', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('checkbox-accelerationOnCoc'));
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByTestId('review-accelerationOnCoc'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('review-accelerationOnCoc').textContent,
    ).toBe('Yes');
  });

  it('hides acceleration on CoC in review when unchecked', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.queryByTestId('review-accelerationOnCoc'),
    ).not.toBeInTheDocument();
  });

  it('shows notes in review when provided', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('input-notes'), {
      target: { value: 'Test notes for grant' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('review-notes')).toBeInTheDocument();
    expect(screen.getByTestId('review-notes').textContent).toBe(
      'Test notes for grant',
    );
  });

  it('hides notes in review when empty', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.queryByTestId('review-notes'),
    ).not.toBeInTheDocument();
  });

  it('shows linked shareholder in review when selected', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('select-shareholderId'), {
      target: { value: 'sh-1' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByTestId('review-shareholder'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('review-shareholder').textContent,
    ).toBe('João da Silva');
  });

  it('hides shareholder in review when not selected', () => {
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.queryByTestId('review-shareholder'),
    ).not.toBeInTheDocument();
  });

  // --- Form Submission ---

  it('submits the form with correct payload', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'grant-1' });
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          optionPlanId: 'plan-1',
          employeeName: 'João da Silva',
          employeeEmail: 'joao@company.com',
          quantity: '10000',
          strikePrice: '5.00',
          grantDate: '2026-03-01',
          expirationDate: '2036-03-01',
          cliffMonths: 12,
          vestingDurationMonths: 48,
          vestingFrequency: 'MONTHLY',
        }),
      );
    });
  });

  it('includes optional fields when provided', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'grant-1' });
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('select-shareholderId'), {
      target: { value: 'sh-1' },
    });
    fireEvent.click(screen.getByTestId('checkbox-accelerationOnCoc'));
    fireEvent.change(screen.getByTestId('input-notes'), {
      target: { value: 'Test notes' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          shareholderId: 'sh-1',
          accelerationOnCoc: true,
          notes: 'Test notes',
        }),
      );
    });
  });

  it('does not include optional fields when not provided', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'grant-1' });
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      const call = mockMutateAsync.mock.calls[0][0];
      expect(call).not.toHaveProperty('shareholderId');
      expect(call).not.toHaveProperty('accelerationOnCoc');
      expect(call).not.toHaveProperty('notes');
    });
  });

  it('shows success toast and navigates on success', async () => {
    const { toast } = require('sonner');
    mockMutateAsync.mockResolvedValueOnce({ id: 'grant-1' });
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Option grant created successfully',
      );
      expect(mockPush).toHaveBeenCalledWith('/dashboard/options');
    });
  });

  it('shows error toast on submission failure', async () => {
    const error = new Error('API Error');
    mockMutateAsync.mockRejectedValueOnce(error);
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(error);
    });
  });

  it('disables submit button and shows loading text when pending', () => {
    mockUseCreateOptionGrant.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });
    render(<CreateOptionGrantPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('next-button'));

    const submitButton = screen.getByTestId('submit-button');
    expect(submitButton).toBeDisabled();
    expect(submitButton.textContent).toBe('Loading...');
  });

  // --- Cancel Button ---

  it('renders Cancel link pointing to options list', () => {
    render(<CreateOptionGrantPage />);
    const cancelLink = screen.getByText('Cancel');
    expect(cancelLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/options',
    );
  });

  // --- Vesting Frequency Change ---

  it('changes vesting frequency when a different option is selected', () => {
    render(<CreateOptionGrantPage />);
    const select = screen.getByTestId('select-vestingFrequency');
    fireEvent.change(select, { target: { value: 'QUARTERLY' } });
    expect(select).toHaveValue('QUARTERLY');
  });

  // --- Edge Cases ---

  it('handles empty plans list gracefully', () => {
    mockUseOptionPlans.mockReturnValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
      },
      isLoading: false,
    });
    render(<CreateOptionGrantPage />);
    const select = screen.getByTestId('select-optionPlanId');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(1); // only placeholder
  });

  it('handles empty shareholders list gracefully', () => {
    mockUseShareholders.mockReturnValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
      },
      isLoading: false,
    });
    render(<CreateOptionGrantPage />);
    const select = screen.getByTestId('select-shareholderId');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(1); // only "None" option
  });
});
