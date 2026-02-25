import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionsPage from './page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const keys: Record<string, Record<string, string>> = {
      transactions: {
        title: 'Transactions',
        description: 'View and manage all company share transactions.',
        create: 'New Transaction',
        empty: 'No transactions recorded. Create the first transaction to get started.',
        actions: 'Actions',
        noFrom: '—',
        'confirm.cancelTitle': 'Cancel Transaction',
        'confirm.cancel': 'Are you sure you want to cancel this transaction?',
        'confirm.cancelDescription': 'This action cannot be undone. Confirmed transactions cannot be cancelled.',
        'stats.total': 'Total Transactions',
        'stats.confirmed': 'Confirmed',
        'stats.pending': 'Pending',
        'stats.draft': 'Drafts',
        'filter.allTypes': 'All types',
        'filter.allStatuses': 'All statuses',
        'table.date': 'Date',
        'table.type': 'Type',
        'table.from': 'From',
        'table.to': 'To',
        'table.shareClass': 'Class',
        'table.quantity': 'Quantity',
        'table.value': 'Value',
        'table.status': 'Status',
        'type.issuance': 'Issuance',
        'type.transfer': 'Transfer',
        'type.conversion': 'Conversion',
        'type.cancellation': 'Cancellation',
        'type.split': 'Split',
        'status.draft': 'Draft',
        'status.pendingApproval': 'Pending',
        'status.submitted': 'Submitted',
        'status.confirmed': 'Confirmed',
        'status.failed': 'Failed',
        'status.cancelled': 'Cancelled',
        'success.cancelled': 'Transaction cancelled successfully',
        'pagination.showing': `Showing ${params?.from ?? ''} to ${params?.to ?? ''} of ${params?.total ?? ''}`,
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
        'pagination.page': 'Page',
        'pagination.of': 'of',
      },
      common: {
        edit: 'Edit',
        delete: 'Delete',
        cancel: 'Cancel',
        save: 'Save',
        loading: 'Loading...',
      },
    };
    return keys[namespace]?.[key] ?? key;
  },
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
const mockUseTransactions = jest.fn();
const mockUseCancelTransaction = jest.fn();
jest.mock('@/hooks/use-transactions', () => ({
  useTransactions: (...args: unknown[]) => mockUseTransactions(...args),
  useCancelTransaction: (...args: unknown[]) => mockUseCancelTransaction(...args),
}));

// --- Mock data ---

const mockTransactions = [
  {
    id: 'tx-1',
    companyId: 'c1',
    type: 'ISSUANCE' as const,
    status: 'CONFIRMED' as const,
    fromShareholder: null,
    toShareholder: { id: 'sh-1', name: 'João Silva', type: 'FOUNDER' },
    shareClass: { id: 'sc-1', className: 'Ordinária', type: 'COMMON_SHARES' },
    quantity: '10000',
    pricePerShare: '1.00',
    totalValue: '10000.00',
    notes: null,
    requiresBoardApproval: false,
    approvedBy: null,
    approvedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    confirmedAt: '2026-01-15T12:00:00.000Z',
    createdBy: 'user-1',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
  },
  {
    id: 'tx-2',
    companyId: 'c1',
    type: 'TRANSFER' as const,
    status: 'PENDING_APPROVAL' as const,
    fromShareholder: { id: 'sh-1', name: 'João Silva', type: 'FOUNDER' },
    toShareholder: { id: 'sh-2', name: 'Maria Santos', type: 'INVESTOR' },
    shareClass: { id: 'sc-1', className: 'Ordinária', type: 'COMMON_SHARES' },
    quantity: '2000',
    pricePerShare: '2.50',
    totalValue: '5000.00',
    notes: 'Transfer for investment',
    requiresBoardApproval: true,
    approvedBy: null,
    approvedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    confirmedAt: null,
    createdBy: 'user-1',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'tx-3',
    companyId: 'c1',
    type: 'CANCELLATION' as const,
    status: 'DRAFT' as const,
    fromShareholder: { id: 'sh-2', name: 'Maria Santos', type: 'INVESTOR' },
    toShareholder: null,
    shareClass: { id: 'sc-2', className: 'Preferencial A', type: 'PREFERRED_SHARES' },
    quantity: '500',
    pricePerShare: null,
    totalValue: null,
    notes: null,
    requiresBoardApproval: false,
    approvedBy: null,
    approvedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    confirmedAt: null,
    createdBy: 'user-1',
    createdAt: '2026-02-10T10:00:00.000Z',
    updatedAt: '2026-02-10T10:00:00.000Z',
  },
];

const mockMeta = {
  total: 3,
  page: 1,
  limit: 20,
  totalPages: 1,
};

function setupDefaultMocks(overrides?: {
  company?: Record<string, unknown>;
  transactions?: Record<string, unknown>;
  cancelMutation?: Record<string, unknown>;
}) {
  mockUseCompany.mockReturnValue({
    companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
    selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
    setSelectedCompanyId: jest.fn(),
    isLoading: false,
    error: null,
    ...overrides?.company,
  });
  mockUseTransactions.mockReturnValue({
    data: { data: mockTransactions, meta: mockMeta },
    isLoading: false,
    error: null,
    ...overrides?.transactions,
  });
  mockUseCancelTransaction.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides?.cancelMutation,
  });
}

describe('TransactionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no-company empty state when no company is selected', () => {
    setupDefaultMocks({
      company: { selectedCompany: null, companies: [], isLoading: false },
      transactions: { data: undefined },
    });

    render(<TransactionsPage />);

    expect(
      screen.getByText('No transactions recorded. Create the first transaction to get started.'),
    ).toBeInTheDocument();
  });

  it('renders loading skeletons while data is loading', () => {
    setupDefaultMocks({
      company: { isLoading: true },
      transactions: { data: undefined, isLoading: true },
    });

    render(<TransactionsPage />);

    expect(screen.getByText('Transactions')).toBeInTheDocument();
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders page title and description', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(
      screen.getByText('View and manage all company share transactions.'),
    ).toBeInTheDocument();
  });

  it('renders stat cards with computed values', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    expect(screen.getByText('Total Transactions')).toBeInTheDocument();
    // Total from meta.total = 3
    expect(screen.getByText('3')).toBeInTheDocument();
    // Confirmed count: 1 (tx-1)
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
    // Pending count: 1 (tx-2)
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    // Draft count: 1 (tx-3)
    expect(screen.getAllByText('Drafts').length).toBeGreaterThanOrEqual(1);
  });

  it('renders transaction table with data', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    // Shareholder names in From/To columns (Maria Santos appears in both tx-2 to and tx-3 from)
    expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Maria Santos').length).toBeGreaterThanOrEqual(1);

    // Share class names
    expect(screen.getAllByText('Ordinária').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Preferencial A')).toBeInTheDocument();
  });

  it('renders type badges', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    // Type badges (also in filter dropdowns, so use getAllByText)
    expect(screen.getAllByText('Issuance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Transfer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Cancellation').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badges', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    // Status badges: CONFIRMED, PENDING_APPROVAL, DRAFT (also in filter/stats, so use getAllByText)
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no transactions exist', () => {
    setupDefaultMocks({
      transactions: {
        data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        isLoading: false,
      },
    });

    render(<TransactionsPage />);

    expect(
      screen.getByText('No transactions recorded. Create the first transaction to get started.'),
    ).toBeInTheDocument();
  });

  it('renders type and status filter dropdowns', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    expect(screen.getByText('All types')).toBeInTheDocument();
    expect(screen.getByText('All statuses')).toBeInTheDocument();
  });

  it('renders "New Transaction" button with link', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    const addButton = screen.getByText('New Transaction');
    expect(addButton).toBeInTheDocument();
    expect(addButton.closest('a')).toHaveAttribute('href', '/dashboard/transactions/new');
  });

  it('renders table column headers', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(screen.getByText('Class')).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders view links for each transaction', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    const viewLinks = screen.getAllByTitle('Edit');
    expect(viewLinks).toHaveLength(3);
    expect(viewLinks[0].closest('a')).toHaveAttribute('href', '/dashboard/transactions/tx-1');
    expect(viewLinks[1].closest('a')).toHaveAttribute('href', '/dashboard/transactions/tx-2');
    expect(viewLinks[2].closest('a')).toHaveAttribute('href', '/dashboard/transactions/tx-3');
  });

  it('renders cancel button only for cancellable statuses', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    // Cancel buttons: only for DRAFT (tx-3) and PENDING_APPROVAL (tx-2), not CONFIRMED (tx-1)
    const cancelButtons = screen.getAllByTitle('Cancel');
    expect(cancelButtons).toHaveLength(2);
  });

  it('opens cancel confirmation dialog on cancel click', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    const cancelButtons = screen.getAllByTitle('Cancel');
    fireEvent.click(cancelButtons[0]);

    // Dialog title and confirm button both show "Cancel Transaction"
    expect(screen.getAllByText('Cancel Transaction').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText('This action cannot be undone. Confirmed transactions cannot be cancelled.'),
    ).toBeInTheDocument();
  });

  it('calls cancel mutation when confirmed', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
    setupDefaultMocks({
      cancelMutation: { mutateAsync: mockMutateAsync, isPending: false },
    });

    render(<TransactionsPage />);

    // Click cancel on tx-2 (first cancellable in DOM order, PENDING_APPROVAL)
    const cancelButtons = screen.getAllByTitle('Cancel');
    fireEvent.click(cancelButtons[0]);

    // Click the confirm button in the dialog ("Cancel Transaction")
    const confirmButtons = screen.getAllByText('Cancel Transaction');
    // Last one is the confirm button
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('tx-2');
    });
  });

  it('renders pagination when multiple pages exist', () => {
    setupDefaultMocks({
      transactions: {
        data: {
          data: mockTransactions,
          meta: { total: 50, page: 1, limit: 20, totalPages: 3 },
        },
        isLoading: false,
      },
    });

    render(<TransactionsPage />);

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Page/)).toBeInTheDocument();
  });

  it('does not render pagination when only one page', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('passes filter params to the hook', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    expect(mockUseTransactions).toHaveBeenCalledWith('c1', {
      page: 1,
      limit: 20,
      type: undefined,
      status: undefined,
      sort: '-createdAt',
    });
  });

  it('updates type filter when select changes', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    const selects = screen.getAllByRole('combobox');
    // First select is the type filter
    fireEvent.change(selects[0], { target: { value: 'ISSUANCE' } });

    expect(mockUseTransactions).toHaveBeenCalledWith('c1', expect.objectContaining({
      type: 'ISSUANCE',
    }));
  });

  it('updates status filter when select changes', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    const selects = screen.getAllByRole('combobox');
    // Second select is the status filter
    fireEvent.change(selects[1], { target: { value: 'CONFIRMED' } });

    expect(mockUseTransactions).toHaveBeenCalledWith('c1', expect.objectContaining({
      status: 'CONFIRMED',
    }));
  });

  it('renders error state', () => {
    setupDefaultMocks({
      transactions: {
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load'),
      },
    });

    render(<TransactionsPage />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('shows dash for null from/to shareholders', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    // tx-1 has null fromShareholder, tx-3 has null toShareholder — both show "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows dash for null totalValue', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    // tx-3 has null totalValue — shows "—" in the value column
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('formats currency values in BRL', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    // tx-1 has totalValue '10000.00' → R$ 10.000,00 (space may be regular or non-breaking)
    expect(screen.getByText((content) => /R\$\s*10\.000,00/.test(content))).toBeInTheDocument();
    // tx-2 has totalValue '5000.00' → R$ 5.000,00
    expect(screen.getByText((content) => /R\$\s*5\.000,00/.test(content))).toBeInTheDocument();
  });

  it('formats quantity with pt-BR number format', () => {
    setupDefaultMocks();

    render(<TransactionsPage />);

    // tx-1 quantity '10000' → 10.000
    expect(screen.getByText('10.000')).toBeInTheDocument();
    // tx-2 quantity '2000' → 2.000
    expect(screen.getByText('2.000')).toBeInTheDocument();
  });
});
