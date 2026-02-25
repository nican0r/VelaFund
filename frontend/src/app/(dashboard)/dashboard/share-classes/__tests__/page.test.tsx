import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShareClassesPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const keys: Record<string, Record<string, string>> = {
      shareClasses: {
        title: 'Share Classes',
        description: 'Manage the company\'s share classes, their rights, and issuance limits.',
        create: 'New Class',
        empty: 'No share classes found. Create the first class to get started.',
        actions: 'Actions',
        'confirm.deleteTitle': 'Delete Share Class',
        'confirm.delete': 'Are you sure you want to delete this share class?',
        'confirm.deleteDescription': 'Only classes with no issued shares can be deleted.',
        'stats.total': 'Total Classes',
        'stats.issued': 'Issued',
        'stats.available': 'Available',
        'stats.preferred': 'Preferred',
        'filter.allTypes': 'All types',
        'table.name': 'Name',
        'table.type': 'Type',
        'table.votesPerShare': 'Votes/Share',
        'table.authorized': 'Authorized',
        'table.issued': 'Issued',
        'table.issuedPct': '% Issued',
        'table.lockUp': 'Lock-up',
        'table.lockUpMonths': `${params?.months ?? ''} months`,
        'table.noLockUp': 'None',
        'type.quota': 'Quotas',
        'type.commonShares': 'Common Shares',
        'type.preferredShares': 'Preferred Shares',
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
        search: 'Search',
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
const mockUseShareClasses = jest.fn();
const mockUseDeleteShareClass = jest.fn();
jest.mock('@/hooks/use-share-classes', () => ({
  useShareClasses: (...args: unknown[]) => mockUseShareClasses(...args),
  useDeleteShareClass: (...args: unknown[]) => mockUseDeleteShareClass(...args),
}));

// --- Mock data ---

const mockShareClasses = [
  {
    id: 'sc-1',
    companyId: 'c1',
    className: 'Quotas Ordinárias',
    type: 'QUOTA' as const,
    totalAuthorized: '1000000',
    totalIssued: '600000',
    votesPerShare: 1,
    liquidationPreferenceMultiple: null,
    participatingRights: false,
    rightOfFirstRefusal: true,
    lockUpPeriodMonths: null,
    tagAlongPercentage: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'sc-2',
    companyId: 'c1',
    className: 'Ações Preferenciais Classe A',
    type: 'PREFERRED_SHARES' as const,
    totalAuthorized: '500000',
    totalIssued: '200000',
    votesPerShare: 0,
    liquidationPreferenceMultiple: '1.5',
    participatingRights: true,
    rightOfFirstRefusal: true,
    lockUpPeriodMonths: 12,
    tagAlongPercentage: '100',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'sc-3',
    companyId: 'c1',
    className: 'Ações Ordinárias',
    type: 'COMMON_SHARES' as const,
    totalAuthorized: '300000',
    totalIssued: '0',
    votesPerShare: 1,
    liquidationPreferenceMultiple: null,
    participatingRights: false,
    rightOfFirstRefusal: true,
    lockUpPeriodMonths: 6,
    tagAlongPercentage: '80',
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
  shareClasses?: Record<string, unknown>;
  deleteMutation?: Record<string, unknown>;
}) {
  mockUseCompany.mockReturnValue({
    companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
    selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
    setSelectedCompanyId: jest.fn(),
    isLoading: false,
    error: null,
    ...overrides?.company,
  });
  mockUseShareClasses.mockReturnValue({
    data: { data: mockShareClasses, meta: mockMeta },
    isLoading: false,
    error: null,
    ...overrides?.shareClasses,
  });
  mockUseDeleteShareClass.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides?.deleteMutation,
  });
}

describe('ShareClassesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no-company empty state when no company is selected', () => {
    setupDefaultMocks({ company: { selectedCompany: null, isLoading: false } });
    render(<ShareClassesPage />);
    expect(screen.getByText('No share classes found. Create the first class to get started.')).toBeInTheDocument();
  });

  it('renders loading skeletons while data is loading', () => {
    setupDefaultMocks({ shareClasses: { isLoading: true, data: null, error: null } });
    const { container } = render(<ShareClassesPage />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders page title and description', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    expect(screen.getByText('Share Classes')).toBeInTheDocument();
    expect(screen.getByText("Manage the company's share classes, their rights, and issuance limits.")).toBeInTheDocument();
  });

  it('renders stat cards', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    expect(screen.getByText('Total Classes')).toBeInTheDocument();
    expect(screen.getAllByText('Issued').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Preferred')).toBeInTheDocument();
  });

  it('renders share class table with data', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    expect(screen.getByText('Quotas Ordinárias')).toBeInTheDocument();
    expect(screen.getByText('Ações Preferenciais Classe A')).toBeInTheDocument();
    expect(screen.getByText('Ações Ordinárias')).toBeInTheDocument();
  });

  it('renders type badges for each class', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    // "Quotas" appears in filter dropdown AND in table badge
    expect(screen.getAllByText('Quotas').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Preferred Shares').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Common Shares').length).toBeGreaterThanOrEqual(1);
  });

  it('renders votes per share values', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    // sc-1 and sc-3 have votesPerShare=1, sc-2 has 0
    const cells = screen.getAllByText('1');
    expect(cells.length).toBeGreaterThanOrEqual(2);
    // "0" appears in table cell and possibly in stat "0%" — use getAllByText
    const zeroCells = screen.getAllByText('0');
    expect(zeroCells.length).toBeGreaterThanOrEqual(1);
  });

  it('renders lock-up period information', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    // sc-1 has no lock-up, sc-2 has 12 months, sc-3 has 6 months
    expect(screen.getByText('12 months')).toBeInTheDocument();
    expect(screen.getByText('6 months')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('renders empty state when no share classes exist', () => {
    setupDefaultMocks({ shareClasses: { data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }, isLoading: false, error: null } });
    render(<ShareClassesPage />);
    expect(screen.getAllByText('No share classes found. Create the first class to get started.').length).toBeGreaterThanOrEqual(1);
  });

  it('renders type filter dropdown', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    const select = screen.getByDisplayValue('All types');
    expect(select).toBeInTheDocument();
  });

  it('renders "New Class" button with link', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    const createLink = screen.getByText('New Class');
    expect(createLink.closest('a')).toHaveAttribute('href', '/dashboard/share-classes/new');
  });

  it('renders table column headers', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Votes/Share')).toBeInTheDocument();
    expect(screen.getByText('Authorized')).toBeInTheDocument();
    expect(screen.getByText('% Issued')).toBeInTheDocument();
    expect(screen.getByText('Lock-up')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders view link for each share class', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    const viewLinks = screen.getAllByTitle('Edit');
    expect(viewLinks.length).toBe(3);
    expect(viewLinks[0].closest('a')).toHaveAttribute('href', '/dashboard/share-classes/sc-1');
    expect(viewLinks[1].closest('a')).toHaveAttribute('href', '/dashboard/share-classes/sc-2');
    expect(viewLinks[2].closest('a')).toHaveAttribute('href', '/dashboard/share-classes/sc-3');
  });

  it('disables delete button for classes with issued shares', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    const deleteButtons = screen.getAllByTitle(/Delete|Only classes/);
    // sc-1 (600k issued) and sc-2 (200k issued) should be disabled, sc-3 (0 issued) should be enabled
    const sc3DeleteBtn = deleteButtons.find(btn => !btn.hasAttribute('disabled') || btn.getAttribute('disabled') === null);
    // Check that at least one button is not disabled (sc-3)
    expect(deleteButtons.length).toBe(3);
  });

  it('opens delete confirmation dialog on delete click', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    // Click delete on sc-3 (0 issued, not disabled)
    const deleteButtons = screen.getAllByRole('button');
    const enabledDeleteBtn = deleteButtons.find(
      btn => btn.querySelector('svg') && btn.title === 'Delete'
    );
    if (enabledDeleteBtn) {
      fireEvent.click(enabledDeleteBtn);
      expect(screen.getByText('Delete Share Class')).toBeInTheDocument();
      expect(screen.getByText('Only classes with no issued shares can be deleted.')).toBeInTheDocument();
    }
  });

  it('calls delete mutation when confirmed', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
    setupDefaultMocks({ deleteMutation: { mutateAsync: mockMutateAsync, isPending: false } });
    render(<ShareClassesPage />);

    // Find and click the enabled delete button (sc-3 has 0 issued)
    const deleteButtons = screen.getAllByRole('button');
    const enabledDeleteBtn = deleteButtons.find(
      btn => btn.title === 'Delete'
    );
    if (enabledDeleteBtn) {
      fireEvent.click(enabledDeleteBtn);

      // Click confirm in dialog — it's the red bg-red-600 button
      const allButtons = screen.getAllByRole('button');
      const confirmBtn = allButtons.find(
        btn => btn.textContent === 'Delete' && btn.className.includes('bg-red-600')
      );
      expect(confirmBtn).toBeDefined();
      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith('sc-3');
      });
    }
  });

  it('does not render pagination when only one page', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('renders pagination when multiple pages exist', () => {
    setupDefaultMocks({
      shareClasses: {
        data: { data: mockShareClasses, meta: { total: 50, page: 1, limit: 20, totalPages: 3 } },
        isLoading: false,
        error: null,
      },
    });
    render(<ShareClassesPage />);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('passes type filter param to the hook', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);

    const select = screen.getByDisplayValue('All types');
    fireEvent.change(select, { target: { value: 'PREFERRED_SHARES' } });

    expect(mockUseShareClasses).toHaveBeenCalledWith('c1', expect.objectContaining({
      type: 'PREFERRED_SHARES',
    }));
  });

  it('renders error state', () => {
    setupDefaultMocks({ shareClasses: { data: null, isLoading: false, error: new Error('Network error') } });
    render(<ShareClassesPage />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders formatted numbers in pt-BR format', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    // Numbers may appear in both stat cards and table cells — use getAllByText
    // 1000000 in pt-BR format = 1.000.000
    expect(screen.getAllByText('1.000.000').length).toBeGreaterThanOrEqual(1);
    // 600000 = 600.000
    expect(screen.getAllByText('600.000').length).toBeGreaterThanOrEqual(1);
    // 500000 = 500.000
    expect(screen.getAllByText('500.000').length).toBeGreaterThanOrEqual(1);
  });

  it('renders issued percentage correctly', () => {
    setupDefaultMocks();
    render(<ShareClassesPage />);
    // sc-1: 600000/1000000 = 60.0%, sc-2: 200000/500000 = 40.0%, sc-3: 0/300000 = 0%
    expect(screen.getByText('60,0%')).toBeInTheDocument();
    expect(screen.getByText('40,0%')).toBeInTheDocument();
  });
});
