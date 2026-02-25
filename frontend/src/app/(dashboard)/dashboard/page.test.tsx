import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from './page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const keys: Record<string, string> = {
      title: 'Dashboard',
      description: 'Overview of your company cap table and recent activity.',
      'stats.totalShares': 'Total Shares',
      'stats.shareholders': 'Shareholders',
      'stats.shareClasses': 'Share Classes',
      'stats.transactions': 'Transactions',
      'ownership.title': 'Ownership Distribution',
      'ownership.description': 'Share distribution by shareholder',
      'ownership.others': 'Others',
      'ownership.empty': 'No holdings recorded',
      'recentTransactions.title': 'Recent Transactions',
      'recentTransactions.description': 'Last 5 transactions',
      'recentTransactions.viewAll': 'View all',
      'recentTransactions.shares': 'shares',
      'recentTransactions.empty': 'No transactions found',
      'quickActions.title': 'Quick Actions',
      'quickActions.description': 'Common tasks for cap table management',
      'quickActions.issueShares': 'Issue Shares',
      'quickActions.addShareholder': 'Add Shareholder',
      'quickActions.recordTransfer': 'Record Transfer',
      'quickActions.exportCapTable': 'Export Cap Table',
      'noCompany.title': 'No company found',
      'noCompany.description': 'Create a company to start managing your cap table.',
      'types.issuance': 'Issuance',
      'types.transfer': 'Transfer',
      'types.conversion': 'Conversion',
      'types.cancellation': 'Cancellation',
      'types.split': 'Split',
    };
    return keys[key] ?? key;
  },
}));

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

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
const mockUseCapTable = jest.fn();
const mockUseRecentTransactions = jest.fn();
jest.mock('@/hooks/use-cap-table', () => ({
  useCapTable: (...args: unknown[]) => mockUseCapTable(...args),
}));
jest.mock('@/hooks/use-transactions', () => ({
  useRecentTransactions: (...args: unknown[]) =>
    mockUseRecentTransactions(...args),
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
      shareClassId: 'sc-1',
      shareClassName: 'ON',
      shareClassType: 'COMMON_SHARES',
      shares: '400000',
      ownershipPercentage: '40.000000',
      votingPower: '400000',
      votingPercentage: '40.000000',
    },
  ],
};

const mockTransactions = [
  {
    id: 'tx-1',
    companyId: 'c1',
    type: 'ISSUANCE',
    status: 'CONFIRMED',
    fromShareholder: null,
    toShareholder: { id: 'sh-1', name: 'João Silva', type: 'FOUNDER' },
    shareClass: { id: 'sc-1', className: 'ON', type: 'COMMON_SHARES' },
    quantity: '10000',
    pricePerShare: '1.00',
    totalValue: '10000.00',
    notes: null,
    requiresBoardApproval: false,
    approvedBy: null,
    approvedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    confirmedAt: '2026-02-20T14:30:00.000Z',
    createdBy: 'user-1',
    createdAt: '2026-02-20T14:00:00.000Z',
    updatedAt: '2026-02-20T14:30:00.000Z',
  },
];

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no-company state when user has no companies', () => {
    mockUseCompany.mockReturnValue({
      companies: [],
      selectedCompany: null,
      setSelectedCompanyId: jest.fn(),
      isLoading: false,
      error: null,
    });
    mockUseCapTable.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockUseRecentTransactions.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText('No company found')).toBeInTheDocument();
    expect(
      screen.getByText('Create a company to start managing your cap table.'),
    ).toBeInTheDocument();
  });

  it('renders loading skeletons while data is loading', () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
      selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
      setSelectedCompanyId: jest.fn(),
      isLoading: true,
      error: null,
    });
    mockUseCapTable.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    mockUseRecentTransactions.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total Shares')).toBeInTheDocument();
    // Loading skeletons should be present (animated divs)
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders cap table data in stat cards', () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
      selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
      setSelectedCompanyId: jest.fn(),
      isLoading: false,
      error: null,
    });
    mockUseCapTable.mockReturnValue({
      data: mockCapTable,
      isLoading: false,
      error: null,
    });
    mockUseRecentTransactions.mockReturnValue({
      data: { data: mockTransactions, meta: { total: 24, page: 1, limit: 5, totalPages: 5 } },
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    // Stat cards with formatted values (Brazilian format)
    expect(screen.getByText('1.000.000')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('renders recent transactions', () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
      selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
      setSelectedCompanyId: jest.fn(),
      isLoading: false,
      error: null,
    });
    mockUseCapTable.mockReturnValue({
      data: mockCapTable,
      isLoading: false,
      error: null,
    });
    mockUseRecentTransactions.mockReturnValue({
      data: { data: mockTransactions, meta: { total: 1, page: 1, limit: 5, totalPages: 1 } },
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText('Issuance')).toBeInTheDocument();
    // João Silva appears in both ownership chart and transactions
    expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('10.000')).toBeInTheDocument();
    expect(screen.getByText('View all')).toBeInTheDocument();
  });

  it('renders empty transaction state', () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
      selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
      setSelectedCompanyId: jest.fn(),
      isLoading: false,
      error: null,
    });
    mockUseCapTable.mockReturnValue({
      data: mockCapTable,
      isLoading: false,
      error: null,
    });
    mockUseRecentTransactions.mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 5, totalPages: 0 } },
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText('No transactions found')).toBeInTheDocument();
    expect(screen.queryByText('View all')).not.toBeInTheDocument();
  });

  it('renders quick action links with correct hrefs', () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
      selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
      setSelectedCompanyId: jest.fn(),
      isLoading: false,
      error: null,
    });
    mockUseCapTable.mockReturnValue({
      data: mockCapTable,
      isLoading: false,
      error: null,
    });
    mockUseRecentTransactions.mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 5, totalPages: 0 } },
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText('Issue Shares')).toBeInTheDocument();
    expect(screen.getByText('Add Shareholder')).toBeInTheDocument();
    expect(screen.getByText('Record Transfer')).toBeInTheDocument();
    expect(screen.getByText('Export Cap Table')).toBeInTheDocument();

    // Check links
    const issueLink = screen.getByText('Issue Shares').closest('a');
    expect(issueLink).toHaveAttribute('href', '/dashboard/transactions');

    const addLink = screen.getByText('Add Shareholder').closest('a');
    expect(addLink).toHaveAttribute('href', '/dashboard/shareholders');
  });

  it('renders ownership chart with cap table data', () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
      selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
      setSelectedCompanyId: jest.fn(),
      isLoading: false,
      error: null,
    });
    mockUseCapTable.mockReturnValue({
      data: mockCapTable,
      isLoading: false,
      error: null,
    });
    mockUseRecentTransactions.mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 5, totalPages: 0 } },
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText('Ownership Distribution')).toBeInTheDocument();
    // Chart should show shareholder names from cap table entries
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
  });

  it('renders empty ownership state when cap table has no entries', () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
      selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
      setSelectedCompanyId: jest.fn(),
      isLoading: false,
      error: null,
    });
    mockUseCapTable.mockReturnValue({
      data: { ...mockCapTable, entries: [] },
      isLoading: false,
      error: null,
    });
    mockUseRecentTransactions.mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 5, totalPages: 0 } },
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText('No holdings recorded')).toBeInTheDocument();
  });

  it('passes companyId to hooks', () => {
    mockUseCompany.mockReturnValue({
      companies: [{ id: 'company-abc', name: 'TestCo', status: 'ACTIVE' }],
      selectedCompany: { id: 'company-abc', name: 'TestCo', status: 'ACTIVE' },
      setSelectedCompanyId: jest.fn(),
      isLoading: false,
      error: null,
    });
    mockUseCapTable.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockUseRecentTransactions.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    expect(mockUseCapTable).toHaveBeenCalledWith('company-abc');
    expect(mockUseRecentTransactions).toHaveBeenCalledWith('company-abc');
  });
});
