import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConvertiblesPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const keys: Record<string, Record<string, string>> = {
      convertibles: {
        title: 'Convertible Instruments',
        description: 'View and manage convertible instruments.',
        create: 'New Convertible',
        empty: 'No convertible instruments found. Create the first one to get started.',
        actions: 'Actions',
        'confirm.cancelTitle': 'Cancel Instrument',
        'confirm.cancelDescription': 'Are you sure you want to cancel this convertible instrument? This action cannot be undone.',
        'confirm.cancel': 'Cancel Instrument',
        'stats.total': 'Total Instruments',
        'stats.outstanding': 'Outstanding',
        'stats.totalPrincipal': 'Total Principal',
        'stats.accruedInterest': 'Accrued Interest',
        'filter.allTypes': 'All types',
        'filter.allStatuses': 'All statuses',
        'table.issueDate': 'Issue Date',
        'table.investor': 'Investor',
        'table.type': 'Type',
        'table.principal': 'Principal',
        'table.interestRate': 'Interest Rate',
        'table.accruedInterest': 'Accrued Int.',
        'table.maturityDate': 'Maturity',
        'table.status': 'Status',
        'instrumentType.mutuoConversivel': 'Convertible Note',
        'instrumentType.investimentoAnjo': 'Angel Investment',
        'instrumentType.misto': 'Mixed',
        'instrumentType.mais': 'MAIS',
        'status.outstanding': 'Outstanding',
        'status.converted': 'Converted',
        'status.redeemed': 'Redeemed',
        'status.matured': 'Matured',
        'status.cancelled': 'Cancelled',
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
const mockUseConvertibles = jest.fn();
const mockUseCancelConvertible = jest.fn();
jest.mock('@/hooks/use-convertibles', () => ({
  useConvertibles: (...args: unknown[]) => mockUseConvertibles(...args),
  useCancelConvertible: (...args: unknown[]) => mockUseCancelConvertible(...args),
}));

// --- Mock data ---

const mockInstruments = [
  {
    id: 'conv-1',
    companyId: 'c1',
    shareholderId: 'sh-1',
    instrumentType: 'MUTUO_CONVERSIVEL' as const,
    status: 'OUTSTANDING' as const,
    principalAmount: '500000',
    interestRate: '8',
    interestType: 'SIMPLE' as const,
    accruedInterest: '12500',
    valuationCap: '10000000',
    discountRate: '20',
    qualifiedFinancingThreshold: '1000000',
    conversionTrigger: 'QUALIFIED_FINANCING' as const,
    targetShareClassId: 'sc-1',
    autoConvert: false,
    mfnClause: false,
    issueDate: '2026-01-15T00:00:00.000Z',
    maturityDate: '2028-01-15T00:00:00.000Z',
    convertedAt: null,
    redeemedAt: null,
    cancelledAt: null,
    conversionData: null,
    notes: null,
    createdBy: 'user-1',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    shareholder: { id: 'sh-1', name: 'Fund Alpha', type: 'INVESTOR' },
    targetShareClass: { id: 'sc-1', className: 'ON', type: 'COMMON_SHARES' },
  },
  {
    id: 'conv-2',
    companyId: 'c1',
    shareholderId: 'sh-2',
    instrumentType: 'INVESTIMENTO_ANJO' as const,
    status: 'CONVERTED' as const,
    principalAmount: '200000',
    interestRate: '5',
    interestType: 'COMPOUND' as const,
    accruedInterest: '8000',
    valuationCap: '8000000',
    discountRate: null,
    qualifiedFinancingThreshold: null,
    conversionTrigger: 'MATURITY' as const,
    targetShareClassId: null,
    autoConvert: true,
    mfnClause: false,
    issueDate: '2025-06-01T00:00:00.000Z',
    maturityDate: '2027-06-01T00:00:00.000Z',
    convertedAt: '2026-02-01T12:00:00.000Z',
    redeemedAt: null,
    cancelledAt: null,
    conversionData: null,
    notes: null,
    createdBy: 'user-1',
    createdAt: '2025-06-01T10:00:00.000Z',
    updatedAt: '2026-02-01T12:00:00.000Z',
    shareholder: { id: 'sh-2', name: 'Maria Santos', type: 'INVESTOR' },
    targetShareClass: null,
  },
  {
    id: 'conv-3',
    companyId: 'c1',
    shareholderId: 'sh-3',
    instrumentType: 'MISTO' as const,
    status: 'CANCELLED' as const,
    principalAmount: '100000',
    interestRate: '10',
    interestType: 'SIMPLE' as const,
    accruedInterest: '0',
    valuationCap: null,
    discountRate: '15',
    qualifiedFinancingThreshold: null,
    conversionTrigger: null,
    targetShareClassId: null,
    autoConvert: false,
    mfnClause: true,
    issueDate: '2025-03-10T00:00:00.000Z',
    maturityDate: '2027-03-10T00:00:00.000Z',
    convertedAt: null,
    redeemedAt: null,
    cancelledAt: '2025-12-01T12:00:00.000Z',
    conversionData: null,
    notes: null,
    createdBy: 'user-1',
    createdAt: '2025-03-10T10:00:00.000Z',
    updatedAt: '2025-12-01T12:00:00.000Z',
    shareholder: { id: 'sh-3', name: 'Tech Ventures', type: 'CORPORATE' },
    targetShareClass: null,
  },
];

const mockMeta = {
  total: 3,
  page: 1,
  limit: 20,
  totalPages: 1,
  summary: {
    totalOutstanding: 1,
    totalPrincipal: '800000',
    totalAccruedInterest: '20500',
    totalValue: '820500',
  },
};

function setupDefaultMocks(overrides?: {
  company?: Record<string, unknown>;
  convertibles?: Record<string, unknown>;
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
  mockUseConvertibles.mockReturnValue({
    data: { data: mockInstruments, meta: mockMeta },
    isLoading: false,
    error: null,
    ...overrides?.convertibles,
  });
  mockUseCancelConvertible.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides?.cancelMutation,
  });
}

describe('ConvertiblesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no-company empty state when no company is selected', () => {
    setupDefaultMocks({
      company: { selectedCompany: null, companies: [], isLoading: false },
      convertibles: { data: undefined },
    });

    render(<ConvertiblesPage />);

    expect(
      screen.getByText('No convertible instruments found. Create the first one to get started.'),
    ).toBeInTheDocument();
  });

  it('renders loading skeletons while data is loading', () => {
    setupDefaultMocks({
      company: { isLoading: true },
      convertibles: { data: undefined, isLoading: true },
    });

    render(<ConvertiblesPage />);

    expect(screen.getByText('Convertible Instruments')).toBeInTheDocument();
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders page title and description', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    expect(screen.getByText('Convertible Instruments')).toBeInTheDocument();
    expect(
      screen.getByText('View and manage convertible instruments.'),
    ).toBeInTheDocument();
  });

  it('renders stat cards with summary values', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    expect(screen.getByText('Total Instruments')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('Outstanding').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Principal')).toBeInTheDocument();
    expect(screen.getByText('Accrued Interest')).toBeInTheDocument();
  });

  it('renders convertibles table with data', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    expect(screen.getByText('Fund Alpha')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Tech Ventures')).toBeInTheDocument();
  });

  it('renders type badges', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    expect(screen.getAllByText('Convertible Note').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Angel Investment').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mixed').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badges', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    expect(screen.getAllByText('Outstanding').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Converted').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no instruments exist', () => {
    setupDefaultMocks({
      convertibles: {
        data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        isLoading: false,
      },
    });

    render(<ConvertiblesPage />);

    expect(
      screen.getByText('No convertible instruments found. Create the first one to get started.'),
    ).toBeInTheDocument();
  });

  it('renders type and status filter dropdowns', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    expect(screen.getByDisplayValue('All types')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All statuses')).toBeInTheDocument();
  });

  it('renders "New Convertible" button with link', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    const addButton = screen.getByText('New Convertible');
    expect(addButton).toBeInTheDocument();
    expect(addButton.closest('a')).toHaveAttribute('href', '/dashboard/convertibles/new');
  });

  it('renders table column headers', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    expect(screen.getByText('Issue Date')).toBeInTheDocument();
    expect(screen.getByText('Investor')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('Interest Rate')).toBeInTheDocument();
    expect(screen.getByText('Accrued Int.')).toBeInTheDocument();
    expect(screen.getByText('Maturity')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders view links for each instrument', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    const viewLinks = screen.getAllByTitle('View');
    expect(viewLinks).toHaveLength(3);
    expect(viewLinks[0].closest('a')).toHaveAttribute('href', '/dashboard/convertibles/conv-1');
    expect(viewLinks[1].closest('a')).toHaveAttribute('href', '/dashboard/convertibles/conv-2');
    expect(viewLinks[2].closest('a')).toHaveAttribute('href', '/dashboard/convertibles/conv-3');
  });

  it('renders cancel button only for OUTSTANDING instruments', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    // Cancel button: only for OUTSTANDING (conv-1), not for CONVERTED (conv-2) or CANCELLED (conv-3)
    const cancelButtons = screen.getAllByTitle('Cancel');
    expect(cancelButtons).toHaveLength(1);
  });

  it('opens cancel confirmation dialog on cancel click', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    const cancelButtons = screen.getAllByTitle('Cancel');
    fireEvent.click(cancelButtons[0]);

    // "Cancel Instrument" appears both in dialog title and confirm button
    expect(screen.getAllByText('Cancel Instrument').length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText('Are you sure you want to cancel this convertible instrument? This action cannot be undone.'),
    ).toBeInTheDocument();
  });

  it('calls cancel mutation when confirmed', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
    setupDefaultMocks({
      cancelMutation: { mutateAsync: mockMutateAsync, isPending: false },
    });

    render(<ConvertiblesPage />);

    const cancelButtons = screen.getAllByTitle('Cancel');
    fireEvent.click(cancelButtons[0]);

    // The confirm button text is 'Cancel Instrument' (from confirm.cancel key)
    // There are multiple buttons with that text — find the one in the dialog (red button)
    const confirmButtons = screen.getAllByText('Cancel Instrument');
    // The last one is the confirm button in the dialog
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('conv-1');
    });
  });

  it('renders pagination when multiple pages exist', () => {
    setupDefaultMocks({
      convertibles: {
        data: {
          data: mockInstruments,
          meta: { ...mockMeta, total: 50, totalPages: 3 },
        },
        isLoading: false,
      },
    });

    render(<ConvertiblesPage />);

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Page/)).toBeInTheDocument();
  });

  it('does not render pagination when only one page', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('passes filter params to the hook', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    expect(mockUseConvertibles).toHaveBeenCalledWith('c1', {
      page: 1,
      limit: 20,
      status: undefined,
      sort: '-createdAt',
    });
  });

  it('updates status filter when select changes', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    const selects = screen.getAllByRole('combobox');
    // Second select is the status filter
    fireEvent.change(selects[1], { target: { value: 'OUTSTANDING' } });

    expect(mockUseConvertibles).toHaveBeenCalledWith('c1', expect.objectContaining({
      status: 'OUTSTANDING',
    }));
  });

  it('filters instruments by type client-side when type filter changes', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    const selects = screen.getAllByRole('combobox');
    // First select is the type filter
    fireEvent.change(selects[0], { target: { value: 'MUTUO_CONVERSIVEL' } });

    // After filtering by MUTUO_CONVERSIVEL, only "Fund Alpha" should remain
    expect(screen.getByText('Fund Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
    expect(screen.queryByText('Tech Ventures')).not.toBeInTheDocument();

    const viewLinks = screen.getAllByTitle('View');
    expect(viewLinks).toHaveLength(1);
  });

  it('renders error state', () => {
    setupDefaultMocks({
      convertibles: {
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load'),
      },
    });

    render(<ConvertiblesPage />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('formats currency values in BRL', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    // conv-1 principalAmount '500000' → R$ 500.000,00
    expect(screen.getAllByText((content) => /R\$\s*500\.000,00/.test(content)).length).toBeGreaterThanOrEqual(1);
    // conv-2 principalAmount '200000' → R$ 200.000,00
    expect(screen.getAllByText((content) => /R\$\s*200\.000,00/.test(content)).length).toBeGreaterThanOrEqual(1);
  });

  it('formats dates in pt-BR format', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    // conv-1 issueDate '2026-01-15' → 15/01/2026
    expect(screen.getByText('15/01/2026')).toBeInTheDocument();
    // conv-1 maturityDate '2028-01-15' → 15/01/2028
    expect(screen.getByText('15/01/2028')).toBeInTheDocument();
  });

  it('formats interest rate as percentage', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    // conv-1 interestRate '8' → 8,0% (pt-BR format)
    expect(screen.getAllByText((content) => /8,0%/.test(content)).length).toBeGreaterThanOrEqual(1);
    // conv-2 interestRate '5' → 5,0%
    expect(screen.getAllByText((content) => /5,0%/.test(content)).length).toBeGreaterThanOrEqual(1);
  });

  it('renders stat card values from summary when available', () => {
    setupDefaultMocks();

    render(<ConvertiblesPage />);

    // summary.totalOutstanding = 1
    expect(screen.getByText('1')).toBeInTheDocument();
    // summary.totalPrincipal = '800000' → R$ 800.000,00
    expect(screen.getAllByText((content) => /R\$\s*800\.000,00/.test(content)).length).toBeGreaterThanOrEqual(1);
    // summary.totalAccruedInterest = '20500' → R$ 20.500,00
    expect(screen.getAllByText((content) => /R\$\s*20\.500,00/.test(content)).length).toBeGreaterThanOrEqual(1);
  });
});
