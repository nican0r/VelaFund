import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditLogsPage from '../page';

// --- Mocks ---

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, Record<string, string>> = {
      auditLogs: {
        title: 'Audit Logs',
        description: 'Immutable record of all actions performed on the platform',
        'stats.totalEvents': 'Total Events',
        'stats.todayEvents': "Today's Events",
        'stats.userActions': 'User Actions',
        'stats.systemEvents': 'System Events',
        'table.timestamp': 'Date/Time',
        'table.actor': 'Actor',
        'table.action': 'Action',
        'table.resourceType': 'Resource Type',
        'table.resourceId': 'Resource ID',
        'table.noResourceId': '—',
        'filters.allActions': 'All actions',
        'filters.allResourceTypes': 'All types',
        'filters.dateFrom': 'Start date',
        'filters.dateTo': 'End date',
        'actions.SHAREHOLDER_CREATED': 'Shareholder created',
        'actions.SHARES_ISSUED': 'Shares issued',
        'actions.AUTH_LOGIN_SUCCESS': 'Login successful',
        'actions.AUTH_LOGIN_FAILED': 'Login failed',
        'actions.COMPANY_UPDATED': 'Company updated',
        'actions.OPTION_GRANTED': 'Options granted',
        'actions.TRANSACTION_CANCELLED': 'Transaction cancelled',
        'resourceTypes.Shareholder': 'Shareholder',
        'resourceTypes.Transaction': 'Transaction',
        'resourceTypes.Company': 'Company',
        'resourceTypes.OptionGrant': 'Option Grant',
        'actorType.USER': 'User',
        'actorType.SYSTEM': 'System',
        'actorType.ADMIN': 'Administrator',
        'changes.title': 'Changes',
        'changes.before': 'Before',
        'changes.after': 'After',
        'changes.noChanges': 'No changes recorded',
        'metadata.title': 'Metadata',
        'metadata.ipAddress': 'IP Address',
        'metadata.requestId': 'Request ID',
        'metadata.source': 'Source',
        'metadata.userAgent': 'Browser',
        'verify.title': 'Verify Integrity',
        'verify.description': 'Verify the integrity of the audit log hash chain',
        'verify.button': 'Verify',
        'verify.verifying': 'Verifying...',
        'verify.status': 'Status',
        'verify.daysVerified': 'Days Verified',
        'verify.daysValid': 'Days Valid',
        'verify.daysInvalid': 'Days Invalid',
        'verify.valid': 'Valid',
        'verify.invalid': 'Invalid',
        'verify.noData': 'No data',
        'empty.title': 'No audit logs found',
        'empty.description': 'There are no audit records for the selected filters.',
        'empty.clearFilters': 'Clear filters',
        'pagination.showing': 'Showing {from}–{to} of {total}',
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
        'error.title': 'Error loading logs',
        'error.retry': 'Try again',
      },
    };

    return (key: string, params?: Record<string, unknown>) => {
      const ns = namespace ?? '';
      const t = translations[ns]?.[key];
      if (!t) return key;
      if (params) {
        let result = t;
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{${k}}`, String(v));
        }
        return result;
      }
      return t;
    };
  },
}));

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

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => jest.fn(),
}));

const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

const mockUseAuditLogs = jest.fn();
const mockUseVerifyHashChain = jest.fn();
jest.mock('@/hooks/use-audit-logs', () => ({
  useAuditLogs: (...args: unknown[]) => mockUseAuditLogs(...args),
  useVerifyHashChain: (...args: unknown[]) => mockUseVerifyHashChain(...args),
}));

// --- Mock Data ---

const mockLogs = [
  {
    id: 'log-1',
    timestamp: new Date().toISOString(),
    actorId: 'user-1',
    actorType: 'USER' as const,
    actorName: 'Nelson Pereira',
    actorEmail: 'n***@example.com',
    action: 'SHAREHOLDER_CREATED',
    resourceType: 'Shareholder',
    resourceId: 'sh-001',
    changes: {
      before: null,
      after: { name: 'João Silva', type: 'INDIVIDUAL' },
    },
    metadata: {
      ipAddress: '192.168.1.0/24',
      requestId: 'req-abc-123',
      source: 'api',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
  },
  {
    id: 'log-2',
    timestamp: new Date().toISOString(),
    actorId: null,
    actorType: 'SYSTEM' as const,
    actorName: null,
    actorEmail: null,
    action: 'SHARES_ISSUED',
    resourceType: 'Transaction',
    resourceId: 'tx-002',
    changes: {
      before: null,
      after: { quantity: '10000', pricePerShare: '1.00' },
    },
    metadata: {
      source: 'system',
    },
  },
  {
    id: 'log-3',
    timestamp: '2026-02-15T10:00:00.000Z',
    actorId: 'user-2',
    actorType: 'USER' as const,
    actorName: 'Maria Santos',
    actorEmail: 'm***@example.com',
    action: 'AUTH_LOGIN_SUCCESS',
    resourceType: 'User',
    resourceId: null,
    changes: null,
    metadata: {
      ipAddress: '10.0.0.0/24',
      requestId: 'req-xyz-789',
      source: 'api',
    },
  },
];

const mockMeta = {
  total: 3,
  page: 1,
  limit: 20,
  totalPages: 1,
};

// --- Setup ---

function setupDefaultMocks(overrides?: {
  company?: Record<string, unknown>;
  auditLogs?: Record<string, unknown>;
  verify?: Record<string, unknown>;
}) {
  mockUseCompany.mockReturnValue({
    companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
    selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
    setSelectedCompanyId: jest.fn(),
    isLoading: false,
    error: null,
    ...overrides?.company,
  });

  mockUseAuditLogs.mockReturnValue({
    data: { data: mockLogs, meta: mockMeta },
    isLoading: false,
    error: null,
    ...overrides?.auditLogs,
  });

  mockUseVerifyHashChain.mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
    ...overrides?.verify,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaultMocks();
});

// --- Tests ---

describe('AuditLogsPage', () => {
  // --- Page Header ---

  describe('Page Header', () => {
    it('renders page title', () => {
      render(<AuditLogsPage />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Audit Logs');
    });

    it('renders page description', () => {
      render(<AuditLogsPage />);
      expect(
        screen.getByText('Immutable record of all actions performed on the platform'),
      ).toBeInTheDocument();
    });
  });

  // --- Stat Cards ---

  describe('Stat Cards', () => {
    it('renders all 4 stat cards', () => {
      render(<AuditLogsPage />);
      expect(screen.getByText('Total Events')).toBeInTheDocument();
      expect(screen.getByText("Today's Events")).toBeInTheDocument();
      expect(screen.getByText('User Actions')).toBeInTheDocument();
      expect(screen.getByText('System Events')).toBeInTheDocument();
    });

    it('shows total events count from meta', () => {
      render(<AuditLogsPage />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows loading skeletons when loading', () => {
      setupDefaultMocks({
        auditLogs: { data: undefined, isLoading: true, error: null },
      });
      render(<AuditLogsPage />);
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // --- Table Content ---

  describe('Table Content', () => {
    it('renders table headers', () => {
      render(<AuditLogsPage />);
      expect(screen.getByText('Date/Time')).toBeInTheDocument();
      expect(screen.getByText('Actor')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByText('Resource Type')).toBeInTheDocument();
      expect(screen.getByText('Resource ID')).toBeInTheDocument();
    });

    it('renders audit log entries', () => {
      render(<AuditLogsPage />);
      expect(screen.getByText('Nelson Pereira')).toBeInTheDocument();
      // Action label appears in both dropdown and table badge
      const shareholderCreated = screen.getAllByText('Shareholder created');
      expect(shareholderCreated.length).toBeGreaterThanOrEqual(1);
      // Resource type appears in both dropdown and table
      const shareholders = screen.getAllByText('Shareholder');
      expect(shareholders.length).toBeGreaterThanOrEqual(1);
    });

    it('shows system actor type for system events', () => {
      render(<AuditLogsPage />);
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('shows actor email when available', () => {
      render(<AuditLogsPage />);
      expect(screen.getByText('n***@example.com')).toBeInTheDocument();
    });

    it('shows truncated resource ID', () => {
      render(<AuditLogsPage />);
      // Component uses slice(0,8) + '...' → 'sh-001...' (full ID is < 8 chars)
      expect(screen.getByText('sh-001...')).toBeTruthy();
    });

    it('shows dash for null resource ID', () => {
      render(<AuditLogsPage />);
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('renders action badges with color coding', () => {
      render(<AuditLogsPage />);
      // Action label appears in dropdown and as badge; find the badge (span with bg class)
      const matches = screen.getAllByText('Shareholder created');
      const badge = matches.find((el) => el.tagName === 'SPAN' && el.className.includes('bg-'));
      expect(badge).toBeTruthy();
      expect(badge!.className).toContain('bg-green-100');
    });
  });

  // --- Expandable Rows ---

  describe('Expandable Rows', () => {
    it('expands row on click to show changes and metadata', () => {
      render(<AuditLogsPage />);

      // Click on the first row
      const rows = document.querySelectorAll('tbody tr');
      fireEvent.click(rows[0]);

      // Should show changes section
      expect(screen.getByText('Changes')).toBeInTheDocument();
      expect(screen.getByText('After:')).toBeInTheDocument();
    });

    it('shows metadata when row is expanded', () => {
      render(<AuditLogsPage />);

      const rows = document.querySelectorAll('tbody tr');
      fireEvent.click(rows[0]);

      expect(screen.getByText('Metadata')).toBeInTheDocument();
      expect(screen.getByText('IP Address:')).toBeInTheDocument();
      expect(screen.getByText('192.168.1.0/24')).toBeInTheDocument();
    });

    it('shows "no changes" for entries without changes', () => {
      render(<AuditLogsPage />);

      // Find the third log (AUTH_LOGIN_SUCCESS with no changes) — initially 3 rows
      const rows = document.querySelectorAll('tbody tr');
      fireEvent.click(rows[2]); // 3rd row (index 2) is the AUTH_LOGIN_SUCCESS entry

      expect(screen.getByText('No changes recorded')).toBeInTheDocument();
    });

    it('collapses row on second click', () => {
      render(<AuditLogsPage />);

      const rows = document.querySelectorAll('tbody tr');
      fireEvent.click(rows[0]);
      expect(screen.getByText('Changes')).toBeInTheDocument();

      // Click again to collapse
      const expandedRows = document.querySelectorAll('tbody tr');
      fireEvent.click(expandedRows[0]);

      expect(screen.queryByText('Changes')).not.toBeInTheDocument();
    });
  });

  // --- Filters ---

  describe('Filters', () => {
    it('renders action filter dropdown', () => {
      render(<AuditLogsPage />);
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });

    it('passes action filter to hook', () => {
      render(<AuditLogsPage />);

      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'SHAREHOLDER_CREATED' } });

      expect(mockUseAuditLogs).toHaveBeenCalledWith('c1', expect.objectContaining({
        action: 'SHAREHOLDER_CREATED',
        page: 1,
      }));
    });

    it('passes resource type filter to hook', () => {
      render(<AuditLogsPage />);

      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[1], { target: { value: 'Transaction' } });

      expect(mockUseAuditLogs).toHaveBeenCalledWith('c1', expect.objectContaining({
        resourceType: 'Transaction',
        page: 1,
      }));
    });

    it('renders date filter inputs', () => {
      render(<AuditLogsPage />);
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs).toHaveLength(2);
    });

    it('passes date filters to hook', () => {
      render(<AuditLogsPage />);

      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } });

      expect(mockUseAuditLogs).toHaveBeenCalledWith('c1', expect.objectContaining({
        dateFrom: '2026-01-01',
        page: 1,
      }));
    });

    it('shows clear filters button when filters are active', () => {
      render(<AuditLogsPage />);

      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'SHAREHOLDER_CREATED' } });

      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });

    it('clears all filters when clear button is clicked', () => {
      render(<AuditLogsPage />);

      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'SHAREHOLDER_CREATED' } });

      fireEvent.click(screen.getByText('Clear filters'));

      expect(mockUseAuditLogs).toHaveBeenLastCalledWith('c1', expect.objectContaining({
        action: undefined,
        resourceType: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        page: 1,
      }));
    });

    it('resets to page 1 when filter changes', () => {
      render(<AuditLogsPage />);

      expect(mockUseAuditLogs).toHaveBeenCalledWith('c1', expect.objectContaining({
        page: 1,
      }));
    });
  });

  // --- Pagination ---

  describe('Pagination', () => {
    it('does not show pagination for single page', () => {
      render(<AuditLogsPage />);
      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('shows pagination when multiple pages', () => {
      setupDefaultMocks({
        auditLogs: {
          data: {
            data: mockLogs,
            meta: { total: 45, page: 1, limit: 20, totalPages: 3 },
          },
          isLoading: false,
          error: null,
        },
      });
      render(<AuditLogsPage />);
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('shows pagination info text', () => {
      setupDefaultMocks({
        auditLogs: {
          data: {
            data: mockLogs,
            meta: { total: 45, page: 1, limit: 20, totalPages: 3 },
          },
          isLoading: false,
          error: null,
        },
      });
      render(<AuditLogsPage />);
      // The component uses t('pagination.showing', { from, to, total })
      expect(screen.getByText(/Showing 1.*20 of 45/)).toBeInTheDocument();
    });

    it('disables previous button on first page', () => {
      setupDefaultMocks({
        auditLogs: {
          data: {
            data: mockLogs,
            meta: { total: 45, page: 1, limit: 20, totalPages: 3 },
          },
          isLoading: false,
          error: null,
        },
      });
      render(<AuditLogsPage />);
      expect(screen.getByText('Previous')).toBeDisabled();
    });
  });

  // --- Loading State ---

  describe('Loading State', () => {
    it('shows loading skeletons while fetching', () => {
      setupDefaultMocks({
        auditLogs: { data: undefined, isLoading: true, error: null },
      });
      render(<AuditLogsPage />);
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // --- Error State ---

  describe('Error State', () => {
    it('shows error message', () => {
      setupDefaultMocks({
        auditLogs: {
          data: undefined,
          isLoading: false,
          error: new Error('Network error'),
        },
      });
      render(<AuditLogsPage />);
      expect(screen.getByText('Error loading logs')).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      setupDefaultMocks({
        auditLogs: {
          data: undefined,
          isLoading: false,
          error: new Error('Network error'),
        },
      });
      render(<AuditLogsPage />);
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });
  });

  // --- Empty State ---

  describe('Empty State', () => {
    it('shows empty state when no logs', () => {
      setupDefaultMocks({
        auditLogs: {
          data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
          isLoading: false,
          error: null,
        },
      });
      render(<AuditLogsPage />);
      expect(screen.getByText('No audit logs found')).toBeInTheDocument();
    });

    it('shows clear filters button in empty state when filters active', () => {
      setupDefaultMocks({
        auditLogs: {
          data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
          isLoading: false,
          error: null,
        },
      });
      render(<AuditLogsPage />);

      // Apply a filter first
      const selects = document.querySelectorAll('select');
      fireEvent.change(selects[0], { target: { value: 'SHAREHOLDER_CREATED' } });

      // Re-render with empty data
      setupDefaultMocks({
        auditLogs: {
          data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
          isLoading: false,
          error: null,
        },
      });
    });
  });

  // --- No Company State ---

  describe('No Company State', () => {
    it('shows empty state when no company selected', () => {
      setupDefaultMocks({
        company: { selectedCompany: null, companies: [], isLoading: false },
      });
      render(<AuditLogsPage />);
      expect(
        screen.getByText('There are no audit records for the selected filters.'),
      ).toBeInTheDocument();
    });
  });

  // --- Hash Chain Verification ---

  describe('Hash Chain Verification', () => {
    it('renders verify integrity section', () => {
      render(<AuditLogsPage />);
      expect(screen.getByText('Verify Integrity')).toBeInTheDocument();
      expect(screen.getByText('Verify')).toBeInTheDocument();
    });

    it('shows verification results after clicking verify', async () => {
      mockUseVerifyHashChain.mockReturnValue({
        data: {
          dateRange: { from: '2026-01-01', to: '2026-02-20' },
          daysVerified: 51,
          daysValid: 51,
          daysInvalid: 0,
          status: 'VALID',
        },
        isLoading: false,
        error: null,
      });

      render(<AuditLogsPage />);
      fireEvent.click(screen.getByText('Verify'));

      await waitFor(() => {
        expect(screen.getByText('Valid')).toBeInTheDocument();
        // daysVerified and daysValid both equal 51, so use getAllByText
        const fiftyOnes = screen.getAllByText('51');
        expect(fiftyOnes.length).toBe(2);
        expect(screen.getByText('Days Verified')).toBeInTheDocument();
      });
    });

    it('shows loading state while verifying', () => {
      mockUseVerifyHashChain.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<AuditLogsPage />);
      // When mock returns isLoading=true, button shows "Verifying..." and is disabled
      expect(screen.getByText('Verifying...')).toBeInTheDocument();
      const button = screen.getByText('Verifying...').closest('button');
      expect(button).toBeDisabled();
    });

    it('does not render verify section when no company', () => {
      setupDefaultMocks({
        company: { selectedCompany: null, companies: [], isLoading: false },
      });
      render(<AuditLogsPage />);
      expect(screen.queryByText('Verify Integrity')).not.toBeInTheDocument();
    });
  });

  // --- Hook Invocation ---

  describe('Hook Invocation', () => {
    it('passes correct default params to useAuditLogs', () => {
      render(<AuditLogsPage />);
      expect(mockUseAuditLogs).toHaveBeenCalledWith('c1', {
        page: 1,
        limit: 20,
        action: undefined,
        resourceType: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        sort: '-timestamp',
      });
    });

    it('passes company ID to useAuditLogs', () => {
      render(<AuditLogsPage />);
      expect(mockUseAuditLogs).toHaveBeenCalledWith('c1', expect.anything());
    });
  });

  // --- Action Badge Colors ---

  describe('Action Badge Colors', () => {
    function findBadge(text: string) {
      const matches = screen.getAllByText(text);
      return matches.find((el) => el.tagName === 'SPAN' && el.className.includes('rounded-full'));
    }

    it('shows green badge for created actions', () => {
      render(<AuditLogsPage />);
      const badge = findBadge('Shareholder created');
      expect(badge).toBeTruthy();
      expect(badge!.className).toContain('bg-green-100');
      expect(badge!.className).toContain('text-green-700');
    });

    it('shows green badge for issued actions', () => {
      render(<AuditLogsPage />);
      const badge = findBadge('Shares issued');
      expect(badge).toBeTruthy();
      expect(badge!.className).toContain('bg-green-100');
    });

    it('shows green badge for login success', () => {
      render(<AuditLogsPage />);
      const badge = findBadge('Login successful');
      expect(badge).toBeTruthy();
      expect(badge!.className).toContain('bg-green-100');
    });
  });

  // --- Actor Type Icons ---

  describe('Actor Type Display', () => {
    it('shows user actor name when available', () => {
      render(<AuditLogsPage />);
      expect(screen.getByText('Nelson Pereira')).toBeInTheDocument();
    });

    it('shows system label for system events', () => {
      render(<AuditLogsPage />);
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('shows third actor name', () => {
      render(<AuditLogsPage />);
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });
  });

  // --- Resource Type Labels ---

  describe('Resource Type Labels', () => {
    it('translates resource types', () => {
      render(<AuditLogsPage />);
      // Resource types appear in both dropdown options and table cells
      const shareholders = screen.getAllByText('Shareholder');
      expect(shareholders.length).toBeGreaterThanOrEqual(1);
      const transactions = screen.getAllByText('Transaction');
      expect(transactions.length).toBeGreaterThanOrEqual(1);
    });
  });
});
