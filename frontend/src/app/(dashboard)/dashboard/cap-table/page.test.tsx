import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CapTablePage from './page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const keys: Record<string, string> = {
      title: 'Cap Table',
      description: 'View and manage your company\'s cap table.',
      empty: 'No holdings recorded. Issue shares to get started.',
      summary: 'Total',
      'stats.totalShares': 'Total Shares',
      'stats.shareholders': 'Shareholders',
      'stats.shareClasses': 'Share Classes',
      'stats.optionPool': 'Option Pool',
      'tabs.current': 'Current',
      'tabs.fullyDiluted': 'Fully Diluted',
      'tabs.history': 'History',
      'table.shareholder': 'Shareholder',
      'table.shareClass': 'Class',
      'table.shares': 'Shares',
      'table.ownership': 'Ownership (%)',
      'table.votingPower': 'Voting Power',
      'table.votingPercentage': 'Vote (%)',
      'filter.allClasses': 'All classes',
      'filter.byClass': 'Filter by class',
      'export.button': 'Export',
      'export.pdf': 'PDF',
      'export.xlsx': 'Excel',
      'export.csv': 'CSV',
      'export.oct': 'OCT JSON',
      'export.downloading': 'Preparing download...',
      'fullyDiluted.currentShares': 'Current Shares',
      'fullyDiluted.currentPercentage': 'Current (%)',
      'fullyDiluted.optionsVested': 'Vested',
      'fullyDiluted.optionsUnvested': 'Unvested',
      'fullyDiluted.fullyDilutedShares': 'Diluted Shares',
      'fullyDiluted.fullyDilutedPercentage': 'Diluted (%)',
      'history.snapshotDate': 'Date',
      'history.totalShares': 'Total Shares',
      'history.totalShareholders': 'Shareholders',
      'history.trigger': 'Event',
      'history.notes': 'Notes',
      'history.createdAt': 'Created at',
      'history.empty': 'No snapshots recorded',
      'types.founder': 'Founder',
      'types.investor': 'Investor',
      'types.employee': 'Employee',
      'types.advisor': 'Advisor',
      'types.corporate': 'Corporate',
      'types.quota': 'Quotas',
      'types.commonShares': 'Common Shares',
      'types.preferredShares': 'Preferred Shares',
    };
    return keys[key] ?? key;
  },
}));

// Mock Recharts
jest.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie">{children}</div>
  ),
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

// Mock company context
const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

// Mock hooks
const mockUseCapTableCurrent = jest.fn();
const mockUseCapTableFullyDiluted = jest.fn();
const mockUseCapTableHistory = jest.fn();
const mockUseExportCapTable = jest.fn();
jest.mock('@/hooks/use-cap-table-page', () => ({
  useCapTableCurrent: (...args: unknown[]) => mockUseCapTableCurrent(...args),
  useCapTableFullyDiluted: (...args: unknown[]) => mockUseCapTableFullyDiluted(...args),
  useCapTableHistory: (...args: unknown[]) => mockUseCapTableHistory(...args),
  useExportCapTable: (...args: unknown[]) => mockUseExportCapTable(...args),
}));

const mockCapTable = {
  company: { id: 'c1', name: 'Acme', entityType: 'LTDA' },
  summary: {
    totalShares: '1000000',
    totalShareholders: 12,
    totalShareClasses: 3,
    lastUpdated: '2026-02-25T10:00:00.000Z',
  },
  entries: [
    {
      shareholderId: 'sh-1',
      shareholderName: 'João Silva',
      shareholderType: 'FOUNDER',
      shareClassId: 'sc-1',
      shareClassName: 'ON',
      shareClassType: 'COMMON_SHARES',
      shares: '600000',
      ownershipPercentage: '60.000000',
      votingPower: '600000',
      votingPercentage: '60.000000',
    },
    {
      shareholderId: 'sh-2',
      shareholderName: 'Maria Santos',
      shareholderType: 'INVESTOR',
      shareClassId: 'sc-2',
      shareClassName: 'PN-A',
      shareClassType: 'PREFERRED_SHARES',
      shares: '400000',
      ownershipPercentage: '40.000000',
      votingPower: '400000',
      votingPercentage: '40.000000',
    },
  ],
};

const mockFullyDiluted = {
  company: { id: 'c1', name: 'Acme', entityType: 'LTDA' },
  summary: {
    totalSharesOutstanding: '1000000',
    totalOptionsOutstanding: '200000',
    fullyDilutedShares: '1200000',
  },
  entries: [
    {
      shareholderId: 'sh-1',
      shareholderName: 'João Silva',
      shareholderType: 'FOUNDER',
      currentShares: '600000',
      currentPercentage: '60.000000',
      optionsVested: '50000',
      optionsUnvested: '50000',
      fullyDilutedShares: '700000',
      fullyDilutedPercentage: '58.333333',
    },
    {
      shareholderId: 'sh-2',
      shareholderName: 'Maria Santos',
      shareholderType: 'INVESTOR',
      currentShares: '400000',
      currentPercentage: '40.000000',
      optionsVested: '0',
      optionsUnvested: '0',
      fullyDilutedShares: '400000',
      fullyDilutedPercentage: '33.333333',
    },
  ],
};

const mockHistoryItems = [
  {
    id: 'snap-1',
    snapshotDate: '2026-02-25T00:00:00.000Z',
    totalShares: '1000000',
    totalShareholders: 12,
    trigger: 'ISSUANCE',
    notes: 'Series A close',
    stateHash: 'abc123',
    createdAt: '2026-02-25T10:00:00.000Z',
  },
  {
    id: 'snap-2',
    snapshotDate: '2026-01-15T00:00:00.000Z',
    totalShares: '800000',
    totalShareholders: 10,
    trigger: 'TRANSFER',
    notes: null,
    stateHash: 'def456',
    createdAt: '2026-01-15T09:00:00.000Z',
  },
];

function setupDefaultMocks(overrides?: {
  company?: Partial<ReturnType<typeof mockUseCompany>>;
  capTable?: Partial<ReturnType<typeof mockUseCapTableCurrent>>;
  fullyDiluted?: Partial<ReturnType<typeof mockUseCapTableFullyDiluted>>;
  history?: Partial<ReturnType<typeof mockUseCapTableHistory>>;
  exportMutation?: Partial<ReturnType<typeof mockUseExportCapTable>>;
}) {
  mockUseCompany.mockReturnValue({
    companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
    selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
    setSelectedCompanyId: jest.fn(),
    isLoading: false,
    error: null,
    ...overrides?.company,
  });
  mockUseCapTableCurrent.mockReturnValue({
    data: mockCapTable,
    isLoading: false,
    error: null,
    ...overrides?.capTable,
  });
  mockUseCapTableFullyDiluted.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    ...overrides?.fullyDiluted,
  });
  mockUseCapTableHistory.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    ...overrides?.history,
  });
  mockUseExportCapTable.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    ...overrides?.exportMutation,
  });
}

describe('CapTablePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no-company empty state when no company is selected', () => {
    setupDefaultMocks({
      company: { selectedCompany: null, companies: [], isLoading: false },
      capTable: { data: undefined },
    });

    render(<CapTablePage />);

    expect(
      screen.getByText('No holdings recorded. Issue shares to get started.'),
    ).toBeInTheDocument();
  });

  it('renders loading skeletons while data is loading', () => {
    setupDefaultMocks({
      company: { isLoading: true },
      capTable: { data: undefined, isLoading: true },
    });

    render(<CapTablePage />);

    expect(screen.getByText('Cap Table')).toBeInTheDocument();
    expect(screen.getByText('Total Shares')).toBeInTheDocument();
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders page title and description', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    expect(screen.getByText('Cap Table')).toBeInTheDocument();
    expect(
      screen.getByText("View and manage your company's cap table."),
    ).toBeInTheDocument();
  });

  it('renders stat cards with formatted data', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    // 1.000.000 appears in stat card + summary row + voting total
    expect(screen.getAllByText('1.000.000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders current cap table with shareholder data', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    // Shareholder names (may appear in table + chart legend)
    expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Maria Santos').length).toBeGreaterThanOrEqual(1);

    // Share class names (may appear in table + filter dropdown)
    expect(screen.getAllByText('ON').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('PN-A').length).toBeGreaterThanOrEqual(1);

    // Shareholder type badges
    expect(screen.getAllByText('Founder').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Investor').length).toBeGreaterThanOrEqual(1);

    // Share class type labels
    expect(screen.getByText('(Common Shares)')).toBeInTheDocument();
    expect(screen.getByText('(Preferred Shares)')).toBeInTheDocument();

    // Formatted shares (Brazilian format) - may appear in table + summary
    expect(screen.getAllByText('600.000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('400.000').length).toBeGreaterThanOrEqual(1);
  });

  it('renders summary row with totals', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    // Summary total shares = 600000 + 400000 = 1000000 (appears in stat card + summary)
    expect(screen.getAllByText('1.000.000').length).toBeGreaterThanOrEqual(2);
    // 100,0% appears in summary row (ownership + voting)
    expect(screen.getAllByText('100,0%').length).toBeGreaterThanOrEqual(2);
  });

  it('renders three tab buttons', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Fully Diluted')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('shows current tab as active by default', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    const currentTab = screen.getByText('Current');
    expect(currentTab).toHaveClass('text-ocean-600');
  });

  it('switches to fully diluted tab on click', () => {
    setupDefaultMocks({
      fullyDiluted: { data: mockFullyDiluted, isLoading: false },
    });

    render(<CapTablePage />);

    fireEvent.click(screen.getByText('Fully Diluted'));

    // Should show fully diluted table headers
    expect(screen.getByText('Current Shares')).toBeInTheDocument();
    expect(screen.getByText('Vested')).toBeInTheDocument();
    expect(screen.getByText('Unvested')).toBeInTheDocument();
    expect(screen.getByText('Diluted Shares')).toBeInTheDocument();
    expect(screen.getByText('Diluted (%)')).toBeInTheDocument();
  });

  it('switches to history tab on click', () => {
    setupDefaultMocks({
      history: {
        data: { data: mockHistoryItems, meta: { total: 2, page: 1, limit: 20, totalPages: 1 } },
        isLoading: false,
      },
    });

    render(<CapTablePage />);

    fireEvent.click(screen.getByText('History'));

    // Should show history table headers
    expect(screen.getByText('Event')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();

    // History data
    expect(screen.getByText('Series A close')).toBeInTheDocument();
    expect(screen.getByText('ISSUANCE')).toBeInTheDocument();
    expect(screen.getByText('TRANSFER')).toBeInTheDocument();
  });

  it('renders empty state when cap table has no entries', () => {
    setupDefaultMocks({
      capTable: { data: { ...mockCapTable, entries: [] } },
    });

    render(<CapTablePage />);

    expect(
      screen.getByText('No holdings recorded. Issue shares to get started.'),
    ).toBeInTheDocument();
  });

  it('renders empty state for history when no snapshots', () => {
    setupDefaultMocks({
      history: {
        data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        isLoading: false,
      },
    });

    render(<CapTablePage />);

    fireEvent.click(screen.getByText('History'));

    expect(screen.getByText('No snapshots recorded')).toBeInTheDocument();
  });

  it('renders export button', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('opens export dropdown on click and shows format options', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    fireEvent.click(screen.getByText('Export'));

    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('Excel')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('OCT JSON')).toBeInTheDocument();
  });

  it('calls export mutation when format is selected', () => {
    const mockMutate = jest.fn();
    setupDefaultMocks({
      exportMutation: { mutate: mockMutate, isPending: false },
    });

    render(<CapTablePage />);

    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('PDF'));

    expect(mockMutate).toHaveBeenCalledWith({ format: 'pdf' });
  });

  it('shows share class filter when multiple classes exist', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    // Two share classes: ON and PN-A → filter should be visible
    expect(screen.getByText('All classes')).toBeInTheDocument();
  });

  it('passes share class filter to hook', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    // Select a share class in the filter — find the select by role
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'sc-1' } });

    // Hook should have been called with the filter value
    expect(mockUseCapTableCurrent).toHaveBeenCalledWith('c1', 'sc-1');
  });

  it('passes companyId to hooks', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    expect(mockUseCapTableCurrent).toHaveBeenCalledWith('c1', undefined);
    expect(mockUseCapTableFullyDiluted).toHaveBeenCalledWith('c1', false);
    expect(mockUseCapTableHistory).toHaveBeenCalledWith('c1', { limit: 20 });
  });

  it('enables fully diluted query only when tab is active', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    // Initially on current tab — fullyDiluted should be disabled
    expect(mockUseCapTableFullyDiluted).toHaveBeenCalledWith('c1', false);

    // Switch to fully diluted tab
    fireEvent.click(screen.getByText('Fully Diluted'));

    // Now it should be enabled
    expect(mockUseCapTableFullyDiluted).toHaveBeenCalledWith('c1', true);
  });

  it('renders ownership chart when entries exist', () => {
    setupDefaultMocks();

    render(<CapTablePage />);

    // Chart should be rendered (via mocked recharts)
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('does not render ownership chart when entries are empty', () => {
    setupDefaultMocks({
      capTable: { data: { ...mockCapTable, entries: [] } },
    });

    render(<CapTablePage />);

    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
  });
});
