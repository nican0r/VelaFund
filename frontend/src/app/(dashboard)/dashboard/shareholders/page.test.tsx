import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShareholdersPage from './page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const keys: Record<string, Record<string, string>> = {
      shareholders: {
        title: 'Shareholders',
        description: 'Manage company shareholders, their holdings, and compliance information.',
        create: 'Add Shareholder',
        empty: 'No shareholders found. Add the first shareholder to get started.',
        actions: 'Actions',
        foreign: 'Foreign',
        'confirm.deleteTitle': 'Remove Shareholder',
        'confirm.delete': 'Are you sure you want to remove this shareholder?',
        'confirm.deleteDescription': 'If the shareholder has shares or transaction history, they will be set to inactive instead of removed.',
        'stats.total': 'Total Shareholders',
        'stats.active': 'Active',
        'stats.corporate': 'Corporate',
        'stats.foreign': 'Foreign',
        'filter.searchPlaceholder': 'Search by name or email...',
        'filter.allTypes': 'All types',
        'filter.allStatuses': 'All statuses',
        'table.name': 'Name',
        'table.cpfCnpj': 'CPF/CNPJ',
        'table.type': 'Type',
        'table.email': 'Email',
        'table.status': 'Status',
        'type.founder': 'Founder',
        'type.investor': 'Investor',
        'type.employee': 'Employee',
        'type.advisor': 'Advisor',
        'type.corporate': 'Corporate',
        'status.active': 'Active',
        'status.inactive': 'Inactive',
        'status.pending': 'Pending',
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
const mockUseShareholders = jest.fn();
const mockUseDeleteShareholder = jest.fn();
jest.mock('@/hooks/use-shareholders', () => ({
  useShareholders: (...args: unknown[]) => mockUseShareholders(...args),
  useDeleteShareholder: (...args: unknown[]) => mockUseDeleteShareholder(...args),
}));

// --- Mock data ---

const mockShareholders = [
  {
    id: 'sh-1',
    companyId: 'c1',
    userId: null,
    name: 'João Silva',
    email: 'joao@example.com',
    phone: null,
    type: 'FOUNDER' as const,
    status: 'ACTIVE' as const,
    cpfCnpj: '123.456.789-09',
    walletAddress: null,
    nationality: 'BR',
    taxResidency: 'BR',
    isForeign: false,
    address: null,
    rdeIedNumber: null,
    rdeIedDate: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'sh-2',
    companyId: 'c1',
    userId: null,
    name: 'Acme Ventures LLC',
    email: 'contact@acme.vc',
    phone: '+1-555-0123',
    type: 'CORPORATE' as const,
    status: 'ACTIVE' as const,
    cpfCnpj: '12.345.678/0001-90',
    walletAddress: null,
    nationality: 'US',
    taxResidency: 'US',
    isForeign: true,
    address: null,
    rdeIedNumber: 'RDE-12345',
    rdeIedDate: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-01-20T10:00:00.000Z',
  },
  {
    id: 'sh-3',
    companyId: 'c1',
    userId: null,
    name: 'Maria Santos',
    email: 'maria@company.com',
    phone: null,
    type: 'EMPLOYEE' as const,
    status: 'PENDING' as const,
    cpfCnpj: '987.654.321-00',
    walletAddress: null,
    nationality: 'BR',
    taxResidency: 'BR',
    isForeign: false,
    address: null,
    rdeIedNumber: null,
    rdeIedDate: null,
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
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
  shareholders?: Record<string, unknown>;
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
  mockUseShareholders.mockReturnValue({
    data: { data: mockShareholders, meta: mockMeta },
    isLoading: false,
    error: null,
    ...overrides?.shareholders,
  });
  mockUseDeleteShareholder.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides?.deleteMutation,
  });
}

describe('ShareholdersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no-company empty state when no company is selected', () => {
    setupDefaultMocks({
      company: { selectedCompany: null, companies: [], isLoading: false },
      shareholders: { data: undefined },
    });

    render(<ShareholdersPage />);

    expect(
      screen.getByText('No shareholders found. Add the first shareholder to get started.'),
    ).toBeInTheDocument();
  });

  it('renders loading skeletons while data is loading', () => {
    setupDefaultMocks({
      company: { isLoading: true },
      shareholders: { data: undefined, isLoading: true },
    });

    render(<ShareholdersPage />);

    expect(screen.getByText('Shareholders')).toBeInTheDocument();
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders page title and description', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    expect(screen.getByText('Shareholders')).toBeInTheDocument();
    expect(
      screen.getByText('Manage company shareholders, their holdings, and compliance information.'),
    ).toBeInTheDocument();
  });

  it('renders stat cards', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    expect(screen.getByText('Total Shareholders')).toBeInTheDocument();
    // Total comes from meta.total
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Corporate').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Foreign').length).toBeGreaterThanOrEqual(1);
  });

  it('renders shareholder table with data', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    // Shareholder names
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Acme Ventures LLC')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();

    // Emails
    expect(screen.getByText('joao@example.com')).toBeInTheDocument();
    expect(screen.getByText('contact@acme.vc')).toBeInTheDocument();
    expect(screen.getByText('maria@company.com')).toBeInTheDocument();

    // Type badges (also in filter dropdowns, so use getAllByText)
    expect(screen.getAllByText('Founder').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Employee').length).toBeGreaterThanOrEqual(1);
  });

  it('renders masked CPF/CNPJ in list view', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    // CPF: 123.456.789-09 → 123.***.***-09
    expect(screen.getByText('123.***.***-09')).toBeInTheDocument();
    // CNPJ: 12.345.678/0001-90 → 12.***.***/0001-90 (masked)
    expect(screen.getByText('12.***.***/0001-90')).toBeInTheDocument();
  });

  it('displays foreign indicator badge', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    // Acme Ventures LLC is foreign — should show Foreign badge
    const foreignBadges = screen.getAllByText('Foreign');
    expect(foreignBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badges', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    // Statuses: 2 ACTIVE, 1 PENDING (also in filter dropdowns, so use getAllByText)
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no shareholders exist', () => {
    setupDefaultMocks({
      shareholders: {
        data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        isLoading: false,
      },
    });

    render(<ShareholdersPage />);

    expect(
      screen.getByText('No shareholders found. Add the first shareholder to get started.'),
    ).toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    expect(
      screen.getByPlaceholderText('Search by name or email...'),
    ).toBeInTheDocument();
  });

  it('renders type and status filter dropdowns', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    expect(screen.getByText('All types')).toBeInTheDocument();
    expect(screen.getByText('All statuses')).toBeInTheDocument();
  });

  it('renders "Add Shareholder" button with link', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    const addButton = screen.getByText('Add Shareholder');
    expect(addButton).toBeInTheDocument();
    expect(addButton.closest('a')).toHaveAttribute('href', '/dashboard/shareholders/new');
  });

  it('renders table column headers', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('CPF/CNPJ')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders action buttons (view and delete) for each row', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    // Each row has a view link and delete button
    const viewLinks = screen.getAllByTitle('Edit');
    expect(viewLinks).toHaveLength(3);

    const deleteButtons = screen.getAllByTitle('Delete');
    expect(deleteButtons).toHaveLength(3);
  });

  it('opens delete confirmation dialog on delete click', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);

    // Dialog title and confirm button both have "Remove Shareholder"
    expect(screen.getAllByText('Remove Shareholder').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText('If the shareholder has shares or transaction history, they will be set to inactive instead of removed.'),
    ).toBeInTheDocument();
  });

  it('calls delete mutation when confirmed', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
    setupDefaultMocks({
      deleteMutation: { mutateAsync: mockMutateAsync, isPending: false },
    });

    render(<ShareholdersPage />);

    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);

    // Click the confirm button in the dialog
    const confirmButton = screen.getAllByText('Remove Shareholder');
    // There should be 2: the dialog title and the confirm button
    fireEvent.click(confirmButton[confirmButton.length - 1]);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('sh-1');
    });
  });

  it('renders pagination when multiple pages exist', () => {
    setupDefaultMocks({
      shareholders: {
        data: {
          data: mockShareholders,
          meta: { total: 50, page: 1, limit: 20, totalPages: 3 },
        },
        isLoading: false,
      },
    });

    render(<ShareholdersPage />);

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Page/)).toBeInTheDocument();
  });

  it('does not render pagination when only one page', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('passes search/filter params to the hook', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    // Initial call should have no search/type/status filters
    expect(mockUseShareholders).toHaveBeenCalledWith('c1', {
      page: 1,
      limit: 20,
      search: undefined,
      type: undefined,
      status: undefined,
      sort: '-createdAt',
    });
  });

  it('updates type filter when select changes', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    const selects = screen.getAllByRole('combobox');
    // First select is the type filter (All types)
    const typeSelect = selects[0];
    fireEvent.change(typeSelect, { target: { value: 'FOUNDER' } });

    expect(mockUseShareholders).toHaveBeenCalledWith('c1', expect.objectContaining({
      type: 'FOUNDER',
    }));
  });

  it('renders error state', () => {
    setupDefaultMocks({
      shareholders: {
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load'),
      },
    });

    render(<ShareholdersPage />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('renders view link for each shareholder pointing to detail page', () => {
    setupDefaultMocks();

    render(<ShareholdersPage />);

    const viewLinks = screen.getAllByTitle('Edit');
    expect(viewLinks[0].closest('a')).toHaveAttribute(
      'href',
      '/dashboard/shareholders/sh-1',
    );
    expect(viewLinks[1].closest('a')).toHaveAttribute(
      'href',
      '/dashboard/shareholders/sh-2',
    );
  });

  it('displays dash for missing email', () => {
    const shareholdersWithoutEmail = [
      { ...mockShareholders[0], email: null },
    ];
    setupDefaultMocks({
      shareholders: {
        data: { data: shareholdersWithoutEmail, meta: { ...mockMeta, total: 1 } },
        isLoading: false,
      },
    });

    render(<ShareholdersPage />);

    // Should show dash for null email
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
