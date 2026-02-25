import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateTransactionPage from './page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const fn = (key: string, params?: Record<string, unknown>) => {
      const keys: Record<string, Record<string, string>> = {
        transactions: {
          title: 'Transactions',
          createTitle: 'New Transaction',
          createDescription: 'Select the transaction type and fill in the details.',
          empty: 'No transactions found.',
          'type.issuance': 'Issuance',
          'type.transfer': 'Transfer',
          'type.conversion': 'Conversion',
          'type.cancellation': 'Cancellation',
          'type.split': 'Split',
          'form.sectionType': 'Transaction Type',
          'form.sectionDetails': 'Transaction Details',
          'form.issuanceDescription': 'Create and issue new shares to a shareholder.',
          'form.transferDescription': 'Transfer shares between two shareholders.',
          'form.conversionDescription': 'Convert shares from one class to another.',
          'form.cancellationDescription': 'Cancel or buy back shares from a shareholder.',
          'form.splitDescription': 'Split or reverse-split shares of a class.',
          'form.shareClass': 'Share Class',
          'form.toShareClass': 'Target Share Class',
          'form.fromShareholder': 'From (Shareholder)',
          'form.toShareholder': 'To (Shareholder)',
          'form.quantity': 'Number of Shares',
          'form.quantityPlaceholder': '0',
          'form.pricePerShare': 'Price per Share (R$)',
          'form.pricePerSharePlaceholder': '0.00',
          'form.splitRatio': 'Split Ratio',
          'form.splitRatioPlaceholder': '2',
          'form.splitRatioHelp': 'Enter the multiplier.',
          'form.notes': 'Notes',
          'form.notesPlaceholder': 'Add optional notes',
          'form.boardApproval': 'Requires board approval',
          'form.boardApprovalDescription': 'This transaction will need to be approved.',
          'form.selectShareClass': 'Select share class',
          'form.selectShareholder': 'Select shareholder',
          'form.selectTargetShareClass': 'Select target share class',
          'form.totalValue': 'Total Value',
          'form.stepDetails': 'Details',
          'form.stepReview': 'Review',
          'form.reviewTitle': 'Transaction Review',
          'form.reviewType': 'Type',
          'form.reviewShareClass': 'Share Class',
          'form.reviewTargetShareClass': 'Target Share Class',
          'form.reviewSourceShareholder': 'From (Shareholder)',
          'form.reviewTargetShareholder': 'To (Shareholder)',
          'form.reviewShareholder': 'Shareholder',
          'form.reviewQuantity': 'Quantity',
          'form.reviewPricePerShare': 'Price per Share',
          'form.reviewTotalValue': 'Total Value',
          'form.reviewSplitRatio': 'Ratio',
          'form.reviewNotes': 'Notes',
          'form.reviewBoardApproval': 'Board Approval',
          'form.reviewBoardRequired': 'Required',
          'form.reviewBoardNotRequired': 'Not required',
          'form.availableShares': `Available: ${params?.available ?? ''}`,
          'success.created': 'Transaction created successfully',
        },
        common: {
          cancel: 'Cancel',
          next: 'Next',
          back: 'Back',
          confirm: 'Confirm',
          loading: 'Loading...',
          save: 'Save',
          create: 'Create',
        },
        errors: {
          'val.required': 'Required',
          'val.mustBePositive': 'Must be greater than zero',
          'txn.sameShareholder': 'Shareholders must be different',
        },
      };
      // Support flat access like errorsT = useTranslations() (namespace is undefined)
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
    // Handle root namespace for errorsT = useTranslations()
    return fn;
  },
}));

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
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
const mockUseCreateTransaction = jest.fn();
const mockUseShareholders = jest.fn();
const mockUseShareClasses = jest.fn();

jest.mock('@/hooks/use-transactions', () => ({
  useCreateTransaction: (...args: unknown[]) => mockUseCreateTransaction(...args),
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
  { id: 'sh-1', name: 'João Silva', type: 'FOUNDER', status: 'ACTIVE' },
  { id: 'sh-2', name: 'Maria Santos', type: 'INVESTOR', status: 'ACTIVE' },
  { id: 'sh-3', name: 'Carlos Fund', type: 'CORPORATE', status: 'ACTIVE' },
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
    className: 'Quotas Preferenciais',
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

  mockUseCreateTransaction.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });

  mockUseShareholders.mockReturnValue({
    data: { data: mockShareholders, meta: { total: 3, page: 1, limit: 100, totalPages: 1 } },
    isLoading: false,
  });

  mockUseShareClasses.mockReturnValue({
    data: { data: mockShareClasses, meta: { total: 2, page: 1, limit: 100, totalPages: 1 } },
    isLoading: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setup();
});

// --- Tests ---

describe('CreateTransactionPage', () => {
  it('renders the page title and description', () => {
    render(<CreateTransactionPage />);
    expect(screen.getByText('New Transaction')).toBeInTheDocument();
    expect(screen.getByText('Select the transaction type and fill in the details.')).toBeInTheDocument();
  });

  it('renders back link to transactions list', () => {
    render(<CreateTransactionPage />);
    const backLink = screen.getByText('Transactions');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/transactions');
  });

  it('renders step indicator', () => {
    render(<CreateTransactionPage />);
    expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('shows empty state when no company selected', () => {
    mockUseCompany.mockReturnValue({ selectedCompany: null, isLoading: false });
    render(<CreateTransactionPage />);
    expect(screen.getByText('No transactions found.')).toBeInTheDocument();
  });

  // --- Type Selection ---

  it('renders all 5 transaction type cards', () => {
    render(<CreateTransactionPage />);
    expect(screen.getByTestId('type-card-ISSUANCE')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-TRANSFER')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-CONVERSION')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-CANCELLATION')).toBeInTheDocument();
    expect(screen.getByTestId('type-card-SPLIT')).toBeInTheDocument();
  });

  it('defaults to ISSUANCE type', () => {
    render(<CreateTransactionPage />);
    const issuanceCard = screen.getByTestId('type-card-ISSUANCE');
    expect(issuanceCard).toHaveClass('border-ocean-600');
  });

  it('selects a different type when clicked', () => {
    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-TRANSFER'));
    expect(screen.getByTestId('type-card-TRANSFER')).toHaveClass('border-ocean-600');
    expect(screen.getByTestId('type-card-ISSUANCE')).not.toHaveClass('border-ocean-600');
  });

  // --- ISSUANCE fields ---

  it('shows correct fields for ISSUANCE type', () => {
    render(<CreateTransactionPage />);
    expect(screen.getByTestId('select-shareClassId')).toBeInTheDocument();
    expect(screen.getByTestId('select-toShareholderId')).toBeInTheDocument();
    expect(screen.getByTestId('input-quantity')).toBeInTheDocument();
    expect(screen.getByTestId('input-pricePerShare')).toBeInTheDocument();
    // Should NOT show from shareholder or split ratio
    expect(screen.queryByTestId('select-fromShareholderId')).not.toBeInTheDocument();
    expect(screen.queryByTestId('input-splitRatio')).not.toBeInTheDocument();
    expect(screen.queryByTestId('select-toShareClassId')).not.toBeInTheDocument();
  });

  // --- TRANSFER fields ---

  it('shows correct fields for TRANSFER type', () => {
    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-TRANSFER'));
    expect(screen.getByTestId('select-fromShareholderId')).toBeInTheDocument();
    expect(screen.getByTestId('select-toShareholderId')).toBeInTheDocument();
    expect(screen.getByTestId('select-shareClassId')).toBeInTheDocument();
    expect(screen.getByTestId('input-quantity')).toBeInTheDocument();
    expect(screen.getByTestId('input-pricePerShare')).toBeInTheDocument();
    expect(screen.queryByTestId('input-splitRatio')).not.toBeInTheDocument();
  });

  // --- CONVERSION fields ---

  it('shows correct fields for CONVERSION type', () => {
    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-CONVERSION'));
    expect(screen.getByTestId('select-shareClassId')).toBeInTheDocument();
    expect(screen.getByTestId('select-toShareClassId')).toBeInTheDocument();
    expect(screen.getByTestId('select-fromShareholderId')).toBeInTheDocument();
    expect(screen.getByTestId('input-quantity')).toBeInTheDocument();
    // No price or to shareholder
    expect(screen.queryByTestId('input-pricePerShare')).not.toBeInTheDocument();
    expect(screen.queryByTestId('select-toShareholderId')).not.toBeInTheDocument();
  });

  // --- CANCELLATION fields ---

  it('shows correct fields for CANCELLATION type', () => {
    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-CANCELLATION'));
    expect(screen.getByTestId('select-shareClassId')).toBeInTheDocument();
    expect(screen.getByTestId('select-fromShareholderId')).toBeInTheDocument();
    expect(screen.getByTestId('input-quantity')).toBeInTheDocument();
    expect(screen.getByTestId('input-pricePerShare')).toBeInTheDocument();
    expect(screen.queryByTestId('select-toShareholderId')).not.toBeInTheDocument();
  });

  // --- SPLIT fields ---

  it('shows correct fields for SPLIT type', () => {
    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-SPLIT'));
    expect(screen.getByTestId('select-shareClassId')).toBeInTheDocument();
    expect(screen.getByTestId('input-splitRatio')).toBeInTheDocument();
    // No shareholder, quantity, or price fields
    expect(screen.queryByTestId('select-fromShareholderId')).not.toBeInTheDocument();
    expect(screen.queryByTestId('select-toShareholderId')).not.toBeInTheDocument();
    expect(screen.queryByTestId('input-quantity')).not.toBeInTheDocument();
    expect(screen.queryByTestId('input-pricePerShare')).not.toBeInTheDocument();
  });

  // --- Share class dropdown ---

  it('renders share classes in dropdown', () => {
    render(<CreateTransactionPage />);
    const select = screen.getByTestId('select-shareClassId');
    const options = select.querySelectorAll('option');
    // First option is placeholder + 2 classes
    expect(options).toHaveLength(3);
    expect(options[1].textContent).toContain('Quotas Ordinárias');
    expect(options[2].textContent).toContain('Quotas Preferenciais');
  });

  // --- Shareholders dropdown ---

  it('renders shareholders in dropdown', () => {
    render(<CreateTransactionPage />);
    const select = screen.getByTestId('select-toShareholderId');
    const options = select.querySelectorAll('option');
    // Placeholder + 3 shareholders
    expect(options).toHaveLength(4);
    expect(options[1].textContent).toContain('João Silva');
    expect(options[2].textContent).toContain('Maria Santos');
    expect(options[3].textContent).toContain('Carlos Fund');
  });

  // --- Board approval checkbox ---

  it('renders board approval checkbox', () => {
    render(<CreateTransactionPage />);
    const checkbox = screen.getByTestId('input-boardApproval');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('toggles board approval checkbox', () => {
    render(<CreateTransactionPage />);
    const checkbox = screen.getByTestId('input-boardApproval');
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  // --- Notes ---

  it('renders notes textarea', () => {
    render(<CreateTransactionPage />);
    expect(screen.getByTestId('input-notes')).toBeInTheDocument();
  });

  // --- Validation ---

  it('shows validation errors when clicking Next with empty required fields', () => {
    render(<CreateTransactionPage />);
    // ISSUANCE default: needs shareClassId, toShareholderId, quantity
    fireEvent.click(screen.getByTestId('next-button'));
    // Should show errors (text "Required" appears for required fields)
    const errors = screen.getAllByText('Required');
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('validates that quantity must be positive', () => {
    render(<CreateTransactionPage />);
    // Select share class and shareholder
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-1' } });
    // Enter negative quantity
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '-10' } });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByText('Must be greater than zero')).toBeInTheDocument();
  });

  it('prevents same shareholder selection in TRANSFER via dropdown filtering', () => {
    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-TRANSFER'));
    // Select sh-1 as "from" shareholder
    fireEvent.change(screen.getByTestId('select-fromShareholderId'), { target: { value: 'sh-1' } });
    // Verify sh-1 is NOT available in the "to" dropdown (already covered by filtering test)
    const toSelect = screen.getByTestId('select-toShareholderId');
    const toOptions = toSelect.querySelectorAll('option');
    const toValues = Array.from(toOptions).map((o) => o.getAttribute('value'));
    expect(toValues).not.toContain('sh-1');
    expect(toValues).toContain('sh-2');
  });

  it('validates split ratio is required for SPLIT', () => {
    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-SPLIT'));
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  // --- Step Navigation ---

  it('navigates to review step when form is valid', () => {
    render(<CreateTransactionPage />);
    // Fill ISSUANCE form
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '1000' } });
    fireEvent.click(screen.getByTestId('next-button'));

    // Should be on review step
    expect(screen.getByText('Transaction Review')).toBeInTheDocument();
    expect(screen.getByTestId('review-type')).toHaveTextContent('Issuance');
  });

  it('shows review details correctly for ISSUANCE', () => {
    render(<CreateTransactionPage />);
    // Fill form
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '5000' } });
    fireEvent.change(screen.getByTestId('input-pricePerShare'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-shareClass')).toHaveTextContent('Quotas Ordinárias');
    expect(screen.getByTestId('review-toShareholder')).toHaveTextContent('João Silva');
    expect(screen.getByTestId('review-quantity')).toHaveTextContent('5.000');
  });

  it('navigates back to details from review', () => {
    render(<CreateTransactionPage />);
    // Fill and go to review
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '1000' } });
    fireEvent.click(screen.getByTestId('next-button'));

    // Click back
    fireEvent.click(screen.getByTestId('back-button'));
    expect(screen.getByText('Transaction Type')).toBeInTheDocument();
  });

  // --- Submission ---

  it('calls createMutation on submit and navigates on success', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'txn-1', type: 'ISSUANCE', status: 'DRAFT' });

    render(<CreateTransactionPage />);
    // Fill form
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '1000' } });
    fireEvent.click(screen.getByTestId('next-button'));

    // Submit
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        type: 'ISSUANCE',
        shareClassId: 'sc-1',
        toShareholderId: 'sh-1',
        quantity: '1000',
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/transactions');
    });
  });

  it('includes optional fields in payload when provided', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'txn-1', type: 'ISSUANCE', status: 'DRAFT' });

    render(<CreateTransactionPage />);
    // Fill form with optional fields
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-2' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '500' } });
    fireEvent.change(screen.getByTestId('input-pricePerShare'), { target: { value: '10.50' } });
    fireEvent.change(screen.getByTestId('input-notes'), { target: { value: 'Series A round' } });
    fireEvent.click(screen.getByTestId('input-boardApproval'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        type: 'ISSUANCE',
        shareClassId: 'sc-1',
        toShareholderId: 'sh-2',
        quantity: '500',
        pricePerShare: '10.50',
        notes: 'Series A round',
        requiresBoardApproval: true,
      });
    });
  });

  it('shows error toast on API failure', async () => {
    const error = new Error('API Error');
    mockMutateAsync.mockRejectedValue(error);

    render(<CreateTransactionPage />);
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '1000' } });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(error);
    });
  });

  it('disables submit button while pending', () => {
    mockUseCreateTransaction.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });

    render(<CreateTransactionPage />);
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '1000' } });
    fireEvent.click(screen.getByTestId('next-button'));

    const submitButton = screen.getByTestId('submit-button');
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Loading...');
  });

  // --- TRANSFER submission ---

  it('sends correct payload for TRANSFER type', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'txn-2', type: 'TRANSFER', status: 'DRAFT' });

    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-TRANSFER'));
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-fromShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-2' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '200' } });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        type: 'TRANSFER',
        shareClassId: 'sc-1',
        fromShareholderId: 'sh-1',
        toShareholderId: 'sh-2',
        quantity: '200',
      });
    });
  });

  // --- SPLIT submission ---

  it('sends correct payload for SPLIT type', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'txn-3', type: 'SPLIT', status: 'DRAFT' });

    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-SPLIT'));
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('input-splitRatio'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        type: 'SPLIT',
        shareClassId: 'sc-1',
        splitRatio: '2',
      });
    });
  });

  // --- CONVERSION submission ---

  it('sends correct payload for CONVERSION type', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'txn-4', type: 'CONVERSION', status: 'DRAFT' });

    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-CONVERSION'));
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareClassId'), { target: { value: 'sc-2' } });
    fireEvent.change(screen.getByTestId('select-fromShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '300' } });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        type: 'CONVERSION',
        shareClassId: 'sc-1',
        toShareClassId: 'sc-2',
        fromShareholderId: 'sh-1',
        quantity: '300',
      });
    });
  });

  // --- CANCELLATION submission ---

  it('sends correct payload for CANCELLATION type', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'txn-5', type: 'CANCELLATION', status: 'DRAFT' });

    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-CANCELLATION'));
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-fromShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '100' } });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        type: 'CANCELLATION',
        shareClassId: 'sc-1',
        fromShareholderId: 'sh-1',
        quantity: '100',
      });
    });
  });

  // --- Total value calculation ---

  it('computes and displays total value in review', () => {
    render(<CreateTransactionPage />);
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('input-pricePerShare'), { target: { value: '50' } });
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-totalValue')).toBeInTheDocument();
  });

  // --- Board approval in review ---

  it('shows board approval status in review', () => {
    render(<CreateTransactionPage />);
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '1000' } });
    fireEvent.click(screen.getByTestId('input-boardApproval'));
    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('review-boardApproval')).toHaveTextContent('Required');
  });

  // --- Cancel link ---

  it('renders cancel link to transactions list', () => {
    render(<CreateTransactionPage />);
    const cancelLink = screen.getByText('Cancel');
    expect(cancelLink.closest('a')).toHaveAttribute('href', '/dashboard/transactions');
  });

  // --- Type switching resets fields ---

  it('resets form fields when changing transaction type', () => {
    render(<CreateTransactionPage />);
    // Fill some fields for ISSUANCE
    fireEvent.change(screen.getByTestId('select-toShareholderId'), { target: { value: 'sh-1' } });
    fireEvent.change(screen.getByTestId('input-quantity'), { target: { value: '500' } });

    // Switch to TRANSFER
    fireEvent.click(screen.getByTestId('type-card-TRANSFER'));

    // Fields should be reset
    const quantity = screen.getByTestId('input-quantity') as HTMLInputElement;
    expect(quantity.value).toBe('');
  });

  // --- Filters self from To Shareholder in TRANSFER ---

  it('filters out from shareholder from to shareholder dropdown in TRANSFER', () => {
    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-TRANSFER'));

    // Select "from" shareholder
    fireEvent.change(screen.getByTestId('select-fromShareholderId'), { target: { value: 'sh-1' } });

    // "to" dropdown should not include sh-1
    const toSelect = screen.getByTestId('select-toShareholderId');
    const options = toSelect.querySelectorAll('option');
    const optionValues = Array.from(options).map((o) => o.getAttribute('value'));
    expect(optionValues).not.toContain('sh-1');
    expect(optionValues).toContain('sh-2');
    expect(optionValues).toContain('sh-3');
  });

  // --- Filters self from Target Share Class in CONVERSION ---

  it('filters out source share class from target dropdown in CONVERSION', () => {
    render(<CreateTransactionPage />);
    fireEvent.click(screen.getByTestId('type-card-CONVERSION'));

    // Select source share class
    fireEvent.change(screen.getByTestId('select-shareClassId'), { target: { value: 'sc-1' } });

    // Target dropdown should not include sc-1
    const targetSelect = screen.getByTestId('select-toShareClassId');
    const options = targetSelect.querySelectorAll('option');
    const optionValues = Array.from(options).map((o) => o.getAttribute('value'));
    expect(optionValues).not.toContain('sc-1');
    expect(optionValues).toContain('sc-2');
  });
});
