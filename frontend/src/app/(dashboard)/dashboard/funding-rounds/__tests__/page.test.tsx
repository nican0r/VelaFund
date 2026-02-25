import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FundingRoundsPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const keys: Record<string, Record<string, string>> = {
      fundingRounds: {
        title: 'Funding Rounds',
        description: 'View and manage all company funding rounds and investment commitments.',
        create: 'New Round',
        empty: 'No funding rounds found. Create the first round to get started.',
        actions: 'Actions',
        'confirm.cancelTitle': 'Cancel Funding Round',
        'confirm.cancelDescription': 'This action cannot be undone. Are you sure you want to cancel this funding round?',
        'confirm.cancel': 'Confirm Cancellation',
        'stats.total': 'Total Rounds',
        'stats.open': 'Open',
        'stats.closed': 'Closed',
        'stats.draft': 'Drafts',
        'filter.allTypes': 'All types',
        'filter.allStatuses': 'All statuses',
        'table.name': 'Name',
        'table.type': 'Type',
        'table.target': 'Target',
        'table.preMoney': 'Pre-Money',
        'table.pricePerShare': 'Price/Share',
        'table.status': 'Status',
        'table.closeDate': 'Close Date',
        'type.preSeed': 'Pre-Seed',
        'type.seed': 'Seed',
        'type.seriesA': 'Series A',
        'type.seriesB': 'Series B',
        'type.seriesC': 'Series C',
        'type.bridge': 'Bridge',
        'type.other': 'Other',
        'status.draft': 'Draft',
        'status.open': 'Open',
        'status.closing': 'Closing',
        'status.closed': 'Closed',
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
const mockUseFundingRounds = jest.fn();
const mockUseCancelFundingRound = jest.fn();
jest.mock('@/hooks/use-funding-rounds', () => ({
  useFundingRounds: (...args: unknown[]) => mockUseFundingRounds(...args),
  useCancelFundingRound: (...args: unknown[]) => mockUseCancelFundingRound(...args),
}));

// --- Mock data ---

const mockRounds = [
  {
    id: 'round-1',
    companyId: 'c1',
    name: 'Seed Round',
    roundType: 'SEED' as const,
    shareClassId: 'sc-1',
    targetAmount: '1000000',
    minimumCloseAmount: '500000',
    hardCap: '1500000',
    preMoneyValuation: '5000000',
    pricePerShare: '10.00',
    status: 'OPEN' as const,
    notes: null,
    targetCloseDate: '2026-06-30T00:00:00.000Z',
    openedAt: '2026-01-15T12:00:00.000Z',
    closedAt: null,
    cancelledAt: null,
    createdBy: 'user-1',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
  },
  {
    id: 'round-2',
    companyId: 'c1',
    name: 'Series A',
    roundType: 'SERIES_A' as const,
    shareClassId: 'sc-2',
    targetAmount: '5000000',
    minimumCloseAmount: null,
    hardCap: null,
    preMoneyValuation: '20000000',
    pricePerShare: '25.00',
    status: 'CLOSED' as const,
    notes: null,
    targetCloseDate: '2025-12-31T00:00:00.000Z',
    openedAt: '2025-10-01T12:00:00.000Z',
    closedAt: '2025-12-15T12:00:00.000Z',
    cancelledAt: null,
    createdBy: 'user-1',
    createdAt: '2025-09-01T10:00:00.000Z',
    updatedAt: '2025-12-15T12:00:00.000Z',
  },
  {
    id: 'round-3',
    companyId: 'c1',
    name: 'Bridge Round',
    roundType: 'BRIDGE' as const,
    shareClassId: 'sc-1',
    targetAmount: '500000',
    minimumCloseAmount: null,
    hardCap: null,
    preMoneyValuation: '3000000',
    pricePerShare: '5.00',
    status: 'DRAFT' as const,
    notes: null,
    targetCloseDate: null,
    openedAt: null,
    closedAt: null,
    cancelledAt: null,
    createdBy: 'user-1',
    createdAt: '2026-02-20T10:00:00.000Z',
    updatedAt: '2026-02-20T10:00:00.000Z',
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
  fundingRounds?: Record<string, unknown>;
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
  mockUseFundingRounds.mockReturnValue({
    data: { data: mockRounds, meta: mockMeta },
    isLoading: false,
    error: null,
    ...overrides?.fundingRounds,
  });
  mockUseCancelFundingRound.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides?.cancelMutation,
  });
}

describe('FundingRoundsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no-company empty state when no company is selected', () => {
    setupDefaultMocks({
      company: { selectedCompany: null, companies: [], isLoading: false },
      fundingRounds: { data: undefined },
    });

    render(<FundingRoundsPage />);

    expect(
      screen.getByText('No funding rounds found. Create the first round to get started.'),
    ).toBeInTheDocument();
  });

  it('renders loading skeletons while data is loading', () => {
    setupDefaultMocks({
      company: { isLoading: true },
      fundingRounds: { data: undefined, isLoading: true },
    });

    render(<FundingRoundsPage />);

    expect(screen.getByText('Funding Rounds')).toBeInTheDocument();
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders page title and description', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    expect(screen.getByText('Funding Rounds')).toBeInTheDocument();
    expect(
      screen.getByText('View and manage all company funding rounds and investment commitments.'),
    ).toBeInTheDocument();
  });

  it('renders stat cards with computed values', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    expect(screen.getByText('Total Rounds')).toBeInTheDocument();
    // Total from meta.total = 3
    expect(screen.getByText('3')).toBeInTheDocument();
    // Open count: 1 (round-1 is OPEN)
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    // Closed count: 1 (round-2)
    expect(screen.getAllByText('Closed').length).toBeGreaterThanOrEqual(1);
    // Draft count: 1 (round-3)
    expect(screen.getAllByText('Drafts').length).toBeGreaterThanOrEqual(1);
  });

  it('renders funding rounds table with data', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    // Round names
    expect(screen.getByText('Seed Round')).toBeInTheDocument();
    // "Series A" appears in dropdown, table name cell, and type badge — use getAllByText
    expect(screen.getAllByText('Series A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bridge Round')).toBeInTheDocument();
  });

  it('renders type badges', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    // Type badges (also in filter dropdown, so use getAllByText)
    expect(screen.getAllByText('Seed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Series A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bridge').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badges', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    // Status badges: OPEN, CLOSED, DRAFT (also in filter/stats, so use getAllByText)
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Closed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no funding rounds exist', () => {
    setupDefaultMocks({
      fundingRounds: {
        data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        isLoading: false,
      },
    });

    render(<FundingRoundsPage />);

    expect(
      screen.getByText('No funding rounds found. Create the first round to get started.'),
    ).toBeInTheDocument();
  });

  it('renders type and status filter dropdowns', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    expect(screen.getByDisplayValue('All types')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All statuses')).toBeInTheDocument();
  });

  it('renders "New Round" button with link', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    const addButton = screen.getByText('New Round');
    expect(addButton).toBeInTheDocument();
    expect(addButton.closest('a')).toHaveAttribute('href', '/dashboard/funding-rounds/new');
  });

  it('renders table column headers', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Pre-Money')).toBeInTheDocument();
    expect(screen.getByText('Price/Share')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Close Date')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders view links for each round', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    const viewLinks = screen.getAllByTitle('View');
    expect(viewLinks).toHaveLength(3);
    expect(viewLinks[0].closest('a')).toHaveAttribute('href', '/dashboard/funding-rounds/round-1');
    expect(viewLinks[1].closest('a')).toHaveAttribute('href', '/dashboard/funding-rounds/round-2');
    expect(viewLinks[2].closest('a')).toHaveAttribute('href', '/dashboard/funding-rounds/round-3');
  });

  it('renders cancel button only for cancellable statuses (DRAFT/OPEN)', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    // Cancel buttons: only for OPEN (round-1) and DRAFT (round-3), not CLOSED (round-2)
    const cancelButtons = screen.getAllByTitle('Cancel');
    expect(cancelButtons).toHaveLength(2);
  });

  it('opens cancel confirmation dialog on cancel click', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    const cancelButtons = screen.getAllByTitle('Cancel');
    fireEvent.click(cancelButtons[0]);

    expect(screen.getByText('Cancel Funding Round')).toBeInTheDocument();
    expect(
      screen.getByText('This action cannot be undone. Are you sure you want to cancel this funding round?'),
    ).toBeInTheDocument();
  });

  it('calls cancel mutation when confirmed', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
    setupDefaultMocks({
      cancelMutation: { mutateAsync: mockMutateAsync, isPending: false },
    });

    render(<FundingRoundsPage />);

    // Click cancel on round-1 (first cancellable, OPEN)
    const cancelButtons = screen.getAllByTitle('Cancel');
    fireEvent.click(cancelButtons[0]);

    // Click the confirm button in the dialog
    const confirmButton = screen.getByText('Confirm Cancellation');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('round-1');
    });
  });

  it('renders pagination when multiple pages exist', () => {
    setupDefaultMocks({
      fundingRounds: {
        data: {
          data: mockRounds,
          meta: { total: 50, page: 1, limit: 20, totalPages: 3 },
        },
        isLoading: false,
      },
    });

    render(<FundingRoundsPage />);

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Page/)).toBeInTheDocument();
  });

  it('does not render pagination when only one page', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('passes filter params to the hook', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    expect(mockUseFundingRounds).toHaveBeenCalledWith('c1', {
      page: 1,
      limit: 20,
      status: undefined,
      sort: '-createdAt',
    });
  });

  it('updates status filter when select changes', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    const selects = screen.getAllByRole('combobox');
    // Second select is the status filter
    fireEvent.change(selects[1], { target: { value: 'OPEN' } });

    expect(mockUseFundingRounds).toHaveBeenCalledWith('c1', expect.objectContaining({
      status: 'OPEN',
    }));
  });

  it('filters rounds by type client-side when type filter changes', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    const selects = screen.getAllByRole('combobox');
    // First select is the type filter
    fireEvent.change(selects[0], { target: { value: 'SEED' } });

    // After filtering by SEED, only "Seed Round" should remain in the table
    expect(screen.getByText('Seed Round')).toBeInTheDocument();
    // "Bridge Round" is unique to the table, should disappear
    expect(screen.queryByText('Bridge Round')).not.toBeInTheDocument();
    // "Series A" still appears in the dropdown option, but the round name cell for it should be gone
    // We verify that only 1 table row remains (Seed Round) by checking view links
    const viewLinks = screen.getAllByTitle('View');
    expect(viewLinks).toHaveLength(1);
  });

  it('renders error state', () => {
    setupDefaultMocks({
      fundingRounds: {
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load'),
      },
    });

    render(<FundingRoundsPage />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('formats currency values in BRL', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    // round-1 targetAmount '1000000' → R$ 1.000.000,00 (space may be regular or non-breaking)
    expect(screen.getAllByText((content) => /R\$\s*1\.000\.000,00/.test(content)).length).toBeGreaterThanOrEqual(1);
    // round-2 targetAmount '5000000' → R$ 5.000.000,00 (also appears in pre-money column)
    expect(screen.getAllByText((content) => /R\$\s*5\.000\.000,00/.test(content)).length).toBeGreaterThanOrEqual(1);
  });

  it('shows dash for null targetCloseDate', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    // round-3 has null targetCloseDate — shows "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('formats close dates in pt-BR format', () => {
    setupDefaultMocks();

    render(<FundingRoundsPage />);

    // round-1 targetCloseDate '2026-06-30' → 30/06/2026
    expect(screen.getByText('30/06/2026')).toBeInTheDocument();
    // round-2 targetCloseDate '2025-12-31' → 31/12/2025
    expect(screen.getByText('31/12/2025')).toBeInTheDocument();
  });
});
