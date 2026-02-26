import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OptionPlansPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const keys: Record<string, Record<string, string>> = {
      optionPlans: {
        title: 'Option Plans',
        description: 'Manage stock option plans, grants, and exercise requests.',
        create: 'New Plan',
        createGrant: 'New Grant',
        empty: 'No option plans found. Create the first plan to get started.',
        emptyGrants: 'No option grants found.',
        emptyExercises: 'No exercise requests found.',
        actions: 'Actions',
        'confirm.closeTitle': 'Close Option Plan',
        'confirm.closeDescription': 'This action cannot be undone. Once closed, no new grants can be created under this plan.',
        'confirm.close': 'Confirm Close',
        'confirm.cancelTitle': 'Cancel Grant',
        'confirm.cancelDescription': 'This action cannot be undone. The grant will be permanently cancelled.',
        'confirm.cancel': 'Confirm Cancellation',
        'confirm.cancelExerciseTitle': 'Cancel Exercise',
        'confirm.cancelExerciseDescription': 'This action cannot be undone. The exercise request will be cancelled.',
        'confirm.cancelExercise': 'Confirm Cancellation',
        'confirmExercise.title': 'Confirm Exercise',
        'confirmExercise.description': 'Confirm that payment has been received.',
        'confirmExercise.employee': 'Employee',
        'confirmExercise.quantity': 'Quantity',
        'confirmExercise.totalCost': 'Total Cost',
        'confirmExercise.paymentReference': 'Payment Reference',
        'confirmExercise.paymentNotes': 'Payment Notes',
        'confirmExercise.paymentNotesPlaceholder': 'e.g. Bank transfer received',
        'confirmExercise.confirmButton': 'Confirm Payment',
        'confirmExercise.cancel': 'Cancel',
        'success.cancelled': 'Grant cancelled successfully',
        'success.cancelledExercise': 'Exercise cancelled successfully',
        'success.closed': 'Plan closed successfully',
        'success.confirmedExercise': 'Exercise confirmed successfully',
        'stats.total': 'Total Plans',
        'stats.active': 'Active',
        'stats.closed': 'Closed',
        'stats.totalOptions': 'Total Options',
        'stats.totalGrants': 'Total Grants',
        'stats.activeGrants': 'Active Grants',
        'stats.exercised': 'Exercised',
        'stats.cancelled': 'Cancelled',
        'stats.totalExercises': 'Total Exercises',
        'stats.pending': 'Pending',
        'stats.completed': 'Completed',
        'filter.allStatuses': 'All statuses',
        'table.name': 'Name',
        'table.shareClass': 'Share Class',
        'table.totalPool': 'Total Pool',
        'table.granted': 'Granted',
        'table.utilization': 'Utilization',
        'table.terminationPolicy': 'Termination Policy',
        'table.status': 'Status',
        'table.employee': 'Employee',
        'table.plan': 'Plan',
        'table.quantity': 'Quantity',
        'table.strikePrice': 'Strike Price',
        'table.exercised': 'Exercised',
        'table.vesting': 'Vesting',
        'table.grantDate': 'Grant Date',
        'table.totalCost': 'Total Cost',
        'table.paymentRef': 'Payment Ref',
        'table.cliffMonths': `${params?.months ?? ''}m cliff`,
        'tabs.plans': 'Plans',
        'tabs.grants': 'Grants',
        'tabs.exercises': 'Exercises',
        'planStatus.active': 'Active',
        'planStatus.closed': 'Closed',
        'grantStatus.active': 'Active',
        'grantStatus.exercised': 'Exercised',
        'grantStatus.cancelled': 'Cancelled',
        'grantStatus.expired': 'Expired',
        'exerciseStatus.pendingPayment': 'Pending Payment',
        'exerciseStatus.paymentConfirmed': 'Payment Confirmed',
        'exerciseStatus.sharesIssued': 'Shares Issued',
        'exerciseStatus.completed': 'Completed',
        'exerciseStatus.cancelled': 'Cancelled',
        'terminationPolicy.forfeiture': 'Forfeiture',
        'terminationPolicy.acceleration': 'Acceleration',
        'terminationPolicy.proRata': 'Pro-Rata',
        'pool.exercised': 'Exercised',
        'pool.granted': 'Granted',
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
const mockUseOptionPlans = jest.fn();
const mockUseClosePlan = jest.fn();
const mockUseOptionGrants = jest.fn();
const mockUseCancelGrant = jest.fn();
const mockUseOptionExercises = jest.fn();
const mockUseCancelExercise = jest.fn();
const mockUseConfirmExercise = jest.fn();
jest.mock('@/hooks/use-option-plans', () => ({
  useOptionPlans: (...args: unknown[]) => mockUseOptionPlans(...args),
  useClosePlan: (...args: unknown[]) => mockUseClosePlan(...args),
  useOptionGrants: (...args: unknown[]) => mockUseOptionGrants(...args),
  useCancelGrant: (...args: unknown[]) => mockUseCancelGrant(...args),
  useOptionExercises: (...args: unknown[]) => mockUseOptionExercises(...args),
  useCancelExercise: (...args: unknown[]) => mockUseCancelExercise(...args),
  useConfirmExercise: (...args: unknown[]) => mockUseConfirmExercise(...args),
}));

// Mock error toast
const mockShowErrorToast = jest.fn();
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => ({ showErrorToast: mockShowErrorToast }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// --- Mock data ---

const mockPlans = [
  {
    id: 'plan-1',
    companyId: 'c1',
    name: 'ESOP 2025',
    shareClassId: 'sc-1',
    totalPoolSize: '100000',
    totalGranted: '60000',
    totalExercised: '10000',
    status: 'ACTIVE' as const,
    boardApprovalDate: '2025-01-15T00:00:00.000Z',
    terminationPolicy: 'FORFEITURE' as const,
    exerciseWindowDays: 90,
    notes: null,
    closedAt: null,
    createdBy: 'user-1',
    createdAt: '2025-01-10T10:00:00.000Z',
    updatedAt: '2025-06-15T12:00:00.000Z',
    shareClass: { id: 'sc-1', className: 'ON', type: 'COMMON_SHARES' },
  },
  {
    id: 'plan-2',
    companyId: 'c1',
    name: 'Advisor Pool',
    shareClassId: 'sc-2',
    totalPoolSize: '50000',
    totalGranted: '25000',
    totalExercised: '5000',
    status: 'CLOSED' as const,
    boardApprovalDate: '2024-06-01T00:00:00.000Z',
    terminationPolicy: 'ACCELERATION' as const,
    exerciseWindowDays: 60,
    notes: null,
    closedAt: '2025-12-01T00:00:00.000Z',
    createdBy: 'user-1',
    createdAt: '2024-06-01T10:00:00.000Z',
    updatedAt: '2025-12-01T12:00:00.000Z',
    shareClass: { id: 'sc-2', className: 'PN-A', type: 'PREFERRED_SHARES' },
  },
];

const mockGrants = [
  {
    id: 'grant-1',
    companyId: 'c1',
    planId: 'plan-1',
    shareholderId: null,
    employeeName: 'João Silva',
    employeeEmail: 'joao@example.com',
    quantity: '10000',
    strikePrice: '5.00',
    exercised: '2000',
    status: 'ACTIVE' as const,
    grantDate: '2025-03-15T00:00:00.000Z',
    expirationDate: '2035-03-15T00:00:00.000Z',
    cliffMonths: 12,
    vestingDurationMonths: 48,
    vestingFrequency: 'MONTHLY' as const,
    cliffPercentage: '25.0',
    accelerationOnCoc: true,
    terminatedAt: null,
    notes: null,
    createdBy: 'user-1',
    createdAt: '2025-03-15T10:00:00.000Z',
    updatedAt: '2025-03-15T10:00:00.000Z',
    plan: { id: 'plan-1', name: 'ESOP 2025' },
  },
  {
    id: 'grant-2',
    companyId: 'c1',
    planId: 'plan-1',
    shareholderId: null,
    employeeName: 'Maria Santos',
    employeeEmail: 'maria@example.com',
    quantity: '5000',
    strikePrice: '5.00',
    exercised: '5000',
    status: 'EXERCISED' as const,
    grantDate: '2025-01-10T00:00:00.000Z',
    expirationDate: '2035-01-10T00:00:00.000Z',
    cliffMonths: 6,
    vestingDurationMonths: 24,
    vestingFrequency: 'QUARTERLY' as const,
    cliffPercentage: '25.0',
    accelerationOnCoc: false,
    terminatedAt: null,
    notes: null,
    createdBy: 'user-1',
    createdAt: '2025-01-10T10:00:00.000Z',
    updatedAt: '2025-12-10T10:00:00.000Z',
    plan: { id: 'plan-1', name: 'ESOP 2025' },
  },
  {
    id: 'grant-3',
    companyId: 'c1',
    planId: 'plan-2',
    shareholderId: null,
    employeeName: 'Carlos Oliveira',
    employeeEmail: 'carlos@example.com',
    quantity: '3000',
    strikePrice: '8.00',
    exercised: '0',
    status: 'CANCELLED' as const,
    grantDate: '2024-08-01T00:00:00.000Z',
    expirationDate: '2034-08-01T00:00:00.000Z',
    cliffMonths: 12,
    vestingDurationMonths: 36,
    vestingFrequency: 'MONTHLY' as const,
    cliffPercentage: '25.0',
    accelerationOnCoc: false,
    terminatedAt: '2025-06-01T00:00:00.000Z',
    notes: null,
    createdBy: 'user-1',
    createdAt: '2024-08-01T10:00:00.000Z',
    updatedAt: '2025-06-01T10:00:00.000Z',
    plan: { id: 'plan-2', name: 'Advisor Pool' },
  },
];

const mockExercises = [
  {
    id: 'exercise-1',
    grantId: 'grant-1',
    quantity: '1000',
    totalCost: '5000',
    paymentReference: 'PIX-20260115',
    status: 'PENDING_PAYMENT' as const,
    confirmedBy: null,
    confirmedAt: null,
    cancelledAt: null,
    blockchainTxHash: null,
    createdBy: 'user-2',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    grant: {
      id: 'grant-1',
      employeeName: 'João Silva',
      employeeEmail: 'joao@example.com',
      strikePrice: '5.00',
      plan: { id: 'plan-1', name: 'ESOP 2025' },
    },
  },
  {
    id: 'exercise-2',
    grantId: 'grant-2',
    quantity: '5000',
    totalCost: '25000',
    paymentReference: 'PIX-20251210',
    status: 'COMPLETED' as const,
    confirmedBy: 'user-1',
    confirmedAt: '2025-12-12T10:00:00.000Z',
    cancelledAt: null,
    blockchainTxHash: '0xabc123',
    createdBy: 'user-2',
    createdAt: '2025-12-10T10:00:00.000Z',
    updatedAt: '2025-12-12T10:00:00.000Z',
    grant: {
      id: 'grant-2',
      employeeName: 'Maria Santos',
      employeeEmail: 'maria@example.com',
      strikePrice: '5.00',
      plan: { id: 'plan-1', name: 'ESOP 2025' },
    },
  },
];

const mockPlansMeta = { total: 2, page: 1, limit: 20, totalPages: 1 };
const mockGrantsMeta = { total: 3, page: 1, limit: 20, totalPages: 1 };
const mockExercisesMeta = { total: 2, page: 1, limit: 20, totalPages: 1 };

function setupDefaultMocks(overrides?: {
  company?: Record<string, unknown>;
  plans?: Record<string, unknown>;
  closePlan?: Record<string, unknown>;
  grants?: Record<string, unknown>;
  cancelGrant?: Record<string, unknown>;
  exercises?: Record<string, unknown>;
  cancelExercise?: Record<string, unknown>;
  confirmExercise?: Record<string, unknown>;
}) {
  mockUseCompany.mockReturnValue({
    companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
    selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
    setSelectedCompanyId: jest.fn(),
    isLoading: false,
    error: null,
    ...overrides?.company,
  });
  mockUseOptionPlans.mockReturnValue({
    data: { data: mockPlans, meta: mockPlansMeta },
    isLoading: false,
    error: null,
    ...overrides?.plans,
  });
  mockUseClosePlan.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides?.closePlan,
  });
  mockUseOptionGrants.mockReturnValue({
    data: { data: mockGrants, meta: mockGrantsMeta },
    isLoading: false,
    error: null,
    ...overrides?.grants,
  });
  mockUseCancelGrant.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides?.cancelGrant,
  });
  mockUseOptionExercises.mockReturnValue({
    data: { data: mockExercises, meta: mockExercisesMeta },
    isLoading: false,
    error: null,
    ...overrides?.exercises,
  });
  mockUseCancelExercise.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides?.cancelExercise,
  });
  mockUseConfirmExercise.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides?.confirmExercise,
  });
}

describe('OptionPlansPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Page-level tests ---

  it('renders page title and description', () => {
    setupDefaultMocks();
    render(<OptionPlansPage />);

    expect(screen.getByText('Option Plans')).toBeInTheDocument();
    expect(
      screen.getByText('Manage stock option plans, grants, and exercise requests.'),
    ).toBeInTheDocument();
  });

  it('renders no-company empty state when no company is selected', () => {
    setupDefaultMocks({
      company: { selectedCompany: null, companies: [], isLoading: false },
      plans: { data: undefined },
      grants: { data: undefined },
      exercises: { data: undefined },
    });

    render(<OptionPlansPage />);

    // No-company state shows Building2 icon and empty message (no page title)
    expect(screen.getByText('No option plans found. Create the first plan to get started.')).toBeInTheDocument();
  });

  it('renders loading skeletons while data is loading', () => {
    setupDefaultMocks({
      company: { isLoading: true },
      plans: { data: undefined, isLoading: true },
      grants: { data: undefined, isLoading: true },
      exercises: { data: undefined, isLoading: true },
    });

    render(<OptionPlansPage />);

    expect(screen.getByText('Option Plans')).toBeInTheDocument();
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders three tab buttons', () => {
    setupDefaultMocks();
    render(<OptionPlansPage />);

    expect(screen.getByText('Plans')).toBeInTheDocument();
    expect(screen.getByText('Grants')).toBeInTheDocument();
    expect(screen.getByText('Exercises')).toBeInTheDocument();
  });

  it('renders "New Plan" button with link on plans tab', () => {
    setupDefaultMocks();
    render(<OptionPlansPage />);

    const addButton = screen.getByText('New Plan');
    expect(addButton).toBeInTheDocument();
    expect(addButton.closest('a')).toHaveAttribute('href', '/dashboard/options/plans/new');
  });

  it('renders "New Grant" button with link on grants tab', () => {
    setupDefaultMocks();
    render(<OptionPlansPage />);

    // Click grants tab
    fireEvent.click(screen.getByText('Grants'));

    const addButton = screen.getByText('New Grant');
    expect(addButton).toBeInTheDocument();
    expect(addButton.closest('a')).toHaveAttribute('href', '/dashboard/options/grants/new');
  });

  // --- Plans Tab tests ---

  describe('Plans Tab', () => {
    it('renders stat cards with computed values', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      expect(screen.getByText('Total Plans')).toBeInTheDocument();
      // Total from meta.total = 2
      expect(screen.getByText('2')).toBeInTheDocument();
      // Active count: 1 (plan-1)
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      // Closed count: 1 (plan-2)
      expect(screen.getAllByText('Closed').length).toBeGreaterThanOrEqual(1);
    });

    it('renders plans table with data', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      expect(screen.getByText('ESOP 2025')).toBeInTheDocument();
      expect(screen.getByText('Advisor Pool')).toBeInTheDocument();
    });

    it('renders table column headers', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Share Class')).toBeInTheDocument();
      expect(screen.getByText('Total Pool')).toBeInTheDocument();
      expect(screen.getByText('Granted')).toBeInTheDocument();
      expect(screen.getByText('Utilization')).toBeInTheDocument();
      expect(screen.getByText('Termination Policy')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('renders share class names', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      expect(screen.getByText('ON')).toBeInTheDocument();
      expect(screen.getByText('PN-A')).toBeInTheDocument();
    });

    it('renders plan status badges', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      // Active and Closed badges
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Closed').length).toBeGreaterThanOrEqual(1);
    });

    it('renders termination policy labels', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      expect(screen.getByText('Forfeiture')).toBeInTheDocument();
      expect(screen.getByText('Acceleration')).toBeInTheDocument();
    });

    it('renders view links for each plan', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      const viewLinks = screen.getAllByTitle('View');
      expect(viewLinks.length).toBeGreaterThanOrEqual(2);
      expect(viewLinks[0].closest('a')).toHaveAttribute('href', '/dashboard/options/plans/plan-1');
      expect(viewLinks[1].closest('a')).toHaveAttribute('href', '/dashboard/options/plans/plan-2');
    });

    it('renders close button only for ACTIVE plans', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      // Close button: only for ACTIVE (plan-1), not CLOSED (plan-2)
      const closeButtons = screen.getAllByTitle('Close');
      expect(closeButtons).toHaveLength(1);
    });

    it('opens close confirmation dialog on close click', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      const closeButton = screen.getByTitle('Close');
      fireEvent.click(closeButton);

      expect(screen.getByText('Close Option Plan')).toBeInTheDocument();
      expect(
        screen.getByText('This action cannot be undone. Once closed, no new grants can be created under this plan.'),
      ).toBeInTheDocument();
    });

    it('calls close mutation when confirmed', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
      setupDefaultMocks({
        closePlan: { mutateAsync: mockMutateAsync, isPending: false },
      });

      render(<OptionPlansPage />);

      fireEvent.click(screen.getByTitle('Close'));
      fireEvent.click(screen.getByText('Confirm Close'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith('plan-1');
      });
    });

    it('renders empty state when no plans exist', () => {
      setupDefaultMocks({
        plans: {
          data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
          isLoading: false,
        },
      });

      render(<OptionPlansPage />);

      expect(
        screen.getByText('No option plans found. Create the first plan to get started.'),
      ).toBeInTheDocument();
    });

    it('renders status filter dropdown', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      expect(screen.getByDisplayValue('All statuses')).toBeInTheDocument();
    });

    it('passes filter params to the hook', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      expect(mockUseOptionPlans).toHaveBeenCalledWith('c1', {
        page: 1,
        limit: 20,
        status: undefined,
        sort: '-createdAt',
      });
    });

    it('updates status filter when select changes', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      const select = screen.getByDisplayValue('All statuses');
      fireEvent.change(select, { target: { value: 'ACTIVE' } });

      expect(mockUseOptionPlans).toHaveBeenCalledWith('c1', expect.objectContaining({
        status: 'ACTIVE',
      }));
    });

    it('renders error state', () => {
      setupDefaultMocks({
        plans: {
          data: undefined,
          isLoading: false,
          error: new Error('Failed to load plans'),
        },
      });

      render(<OptionPlansPage />);

      expect(screen.getByText('Failed to load plans')).toBeInTheDocument();
    });

    it('does not render pagination when only one page', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('renders pagination when multiple pages exist', () => {
      setupDefaultMocks({
        plans: {
          data: {
            data: mockPlans,
            meta: { total: 50, page: 1, limit: 20, totalPages: 3 },
          },
          isLoading: false,
        },
      });

      render(<OptionPlansPage />);

      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText(/Page/)).toBeInTheDocument();
    });

    it('formats numbers in pt-BR format', () => {
      setupDefaultMocks();
      render(<OptionPlansPage />);

      // plan-1 totalPoolSize '100000' → 100.000
      expect(screen.getAllByText((content) => /100\.000/.test(content)).length).toBeGreaterThanOrEqual(1);
      // plan-1 totalGranted '60000' → 60.000
      expect(screen.getAllByText((content) => /60\.000/.test(content)).length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Grants Tab tests ---

  describe('Grants Tab', () => {
    function renderGrantsTab() {
      setupDefaultMocks();
      render(<OptionPlansPage />);
      fireEvent.click(screen.getByText('Grants'));
    }

    it('renders grants stat cards', () => {
      renderGrantsTab();

      expect(screen.getByText('Total Grants')).toBeInTheDocument();
      expect(screen.getByText('Active Grants')).toBeInTheDocument();
      // "Exercised" appears as stat label, column header, and badge — use getAllByText
      expect(screen.getAllByText('Exercised').length).toBeGreaterThanOrEqual(1);
      // Cancelled stat (includes CANCELLED + EXPIRED)
      expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1);
    });

    it('renders grants table with employee data', () => {
      renderGrantsTab();

      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('joao@example.com')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('maria@example.com')).toBeInTheDocument();
      expect(screen.getByText('Carlos Oliveira')).toBeInTheDocument();
      expect(screen.getByText('carlos@example.com')).toBeInTheDocument();
    });

    it('renders grants table column headers', () => {
      renderGrantsTab();

      expect(screen.getByText('Employee')).toBeInTheDocument();
      expect(screen.getByText('Plan')).toBeInTheDocument();
      expect(screen.getByText('Quantity')).toBeInTheDocument();
      expect(screen.getByText('Strike Price')).toBeInTheDocument();
      expect(screen.getAllByText('Exercised').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Vesting')).toBeInTheDocument();
      expect(screen.getByText('Grant Date')).toBeInTheDocument();
    });

    it('renders plan names in grants table', () => {
      renderGrantsTab();

      expect(screen.getAllByText('ESOP 2025').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Advisor Pool')).toBeInTheDocument();
    });

    it('renders grant status badges', () => {
      renderGrantsTab();

      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Exercised').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1);
    });

    it('renders cancel button only for ACTIVE grants', () => {
      renderGrantsTab();

      // Cancel button: only for ACTIVE (grant-1), not EXERCISED (grant-2) or CANCELLED (grant-3)
      const cancelButtons = screen.getAllByTitle('Cancel');
      expect(cancelButtons).toHaveLength(1);
    });

    it('opens cancel confirmation dialog for grants', () => {
      renderGrantsTab();

      const cancelButton = screen.getByTitle('Cancel');
      fireEvent.click(cancelButton);

      expect(screen.getByText('Cancel Grant')).toBeInTheDocument();
      expect(
        screen.getByText('This action cannot be undone. The grant will be permanently cancelled.'),
      ).toBeInTheDocument();
    });

    it('calls cancel grant mutation when confirmed', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
      setupDefaultMocks({
        cancelGrant: { mutateAsync: mockMutateAsync, isPending: false },
      });

      render(<OptionPlansPage />);
      fireEvent.click(screen.getByText('Grants'));

      fireEvent.click(screen.getByTitle('Cancel'));
      fireEvent.click(screen.getByText('Confirm Cancellation'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith('grant-1');
      });
    });

    it('renders empty grants state', () => {
      setupDefaultMocks({
        grants: {
          data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
          isLoading: false,
        },
      });

      render(<OptionPlansPage />);
      fireEvent.click(screen.getByText('Grants'));

      expect(screen.getByText('No option grants found.')).toBeInTheDocument();
    });

    it('renders grants status filter dropdown', () => {
      renderGrantsTab();

      // Should have the status filter for grants tab
      expect(screen.getByDisplayValue('All statuses')).toBeInTheDocument();
    });

    it('formats grant dates in pt-BR format', () => {
      renderGrantsTab();

      // grant-1 grantDate '2025-03-15' → 15/03/2025
      expect(screen.getByText('15/03/2025')).toBeInTheDocument();
      // grant-2 grantDate '2025-01-10' → 10/01/2025
      expect(screen.getByText('10/01/2025')).toBeInTheDocument();
    });

    it('formats currency values in BRL', () => {
      renderGrantsTab();

      // strikePrice '5.00' → R$ 5,00
      expect(screen.getAllByText((content) => /R\$\s*5,00/.test(content)).length).toBeGreaterThanOrEqual(1);
      // strikePrice '8.00' → R$ 8,00
      expect(screen.getAllByText((content) => /R\$\s*8,00/.test(content)).length).toBeGreaterThanOrEqual(1);
    });

    it('renders vesting info with cliff months', () => {
      renderGrantsTab();

      // grant-1: cliffMonths 12, vestingDurationMonths 48 → "12m cliff / 48m"
      // grant-2: cliffMonths 6, vestingDurationMonths 24 → "6m cliff / 24m"
      expect(screen.getAllByText(/12m cliff/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/6m cliff/).length).toBeGreaterThanOrEqual(1);
    });

    it('renders view links for each grant', () => {
      renderGrantsTab();

      const viewLinks = screen.getAllByTitle('View');
      expect(viewLinks.length).toBeGreaterThanOrEqual(3);
    });

    it('passes filter params to grants hook', () => {
      renderGrantsTab();

      expect(mockUseOptionGrants).toHaveBeenCalledWith('c1', {
        page: 1,
        limit: 20,
        status: undefined,
        sort: '-grantDate',
      });
    });
  });

  // --- Exercises Tab tests ---

  describe('Exercises Tab', () => {
    function renderExercisesTab() {
      setupDefaultMocks();
      render(<OptionPlansPage />);
      fireEvent.click(screen.getByText('Exercises'));
    }

    it('renders exercises stat cards', () => {
      renderExercisesTab();

      expect(screen.getByText('Total Exercises')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1);
    });

    it('renders exercises table with data', () => {
      renderExercisesTab();

      // Employee names from grant relation
      expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Maria Santos').length).toBeGreaterThanOrEqual(1);
    });

    it('renders exercises table column headers', () => {
      renderExercisesTab();

      expect(screen.getByText('Employee')).toBeInTheDocument();
      expect(screen.getByText('Plan')).toBeInTheDocument();
      expect(screen.getByText('Quantity')).toBeInTheDocument();
      expect(screen.getByText('Strike Price')).toBeInTheDocument();
      expect(screen.getByText('Total Cost')).toBeInTheDocument();
      expect(screen.getByText('Payment Ref')).toBeInTheDocument();
    });

    it('renders exercise status badges', () => {
      renderExercisesTab();

      // "Pending Payment" appears in filter dropdown AND as a badge — use getAllByText
      expect(screen.getAllByText('Pending Payment').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    });

    it('renders payment references', () => {
      renderExercisesTab();

      expect(screen.getByText('PIX-20260115')).toBeInTheDocument();
      expect(screen.getByText('PIX-20251210')).toBeInTheDocument();
    });

    it('renders cancel button only for PENDING_PAYMENT exercises', () => {
      renderExercisesTab();

      // Cancel button: only for PENDING_PAYMENT (exercise-1), not COMPLETED (exercise-2)
      const cancelButtons = screen.getAllByTitle('Cancel');
      expect(cancelButtons).toHaveLength(1);
    });

    it('opens cancel exercise confirmation dialog', () => {
      renderExercisesTab();

      const cancelButton = screen.getByTitle('Cancel');
      fireEvent.click(cancelButton);

      expect(screen.getByText('Cancel Exercise')).toBeInTheDocument();
      expect(
        screen.getByText('This action cannot be undone. The exercise request will be cancelled.'),
      ).toBeInTheDocument();
    });

    it('calls cancel exercise mutation when confirmed', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
      setupDefaultMocks({
        cancelExercise: { mutateAsync: mockMutateAsync, isPending: false },
      });

      render(<OptionPlansPage />);
      fireEvent.click(screen.getByText('Exercises'));

      fireEvent.click(screen.getByTitle('Cancel'));
      fireEvent.click(screen.getByText('Confirm Cancellation'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith('exercise-1');
      });
    });

    it('renders empty exercises state', () => {
      setupDefaultMocks({
        exercises: {
          data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
          isLoading: false,
        },
      });

      render(<OptionPlansPage />);
      fireEvent.click(screen.getByText('Exercises'));

      expect(screen.getByText('No exercise requests found.')).toBeInTheDocument();
    });

    it('renders exercises status filter with all options', () => {
      renderExercisesTab();

      expect(screen.getByDisplayValue('All statuses')).toBeInTheDocument();
    });

    it('formats total cost in BRL currency', () => {
      renderExercisesTab();

      // exercise-1 totalCost '5000' → R$ 5.000,00
      expect(screen.getAllByText((content) => /R\$\s*5\.000,00/.test(content)).length).toBeGreaterThanOrEqual(1);
      // exercise-2 totalCost '25000' → R$ 25.000,00
      expect(screen.getAllByText((content) => /R\$\s*25\.000,00/.test(content)).length).toBeGreaterThanOrEqual(1);
    });

    it('renders plan name from nested grant relation', () => {
      renderExercisesTab();

      expect(screen.getAllByText('ESOP 2025').length).toBeGreaterThanOrEqual(1);
    });

    it('passes filter params to exercises hook', () => {
      renderExercisesTab();

      expect(mockUseOptionExercises).toHaveBeenCalledWith('c1', {
        page: 1,
        limit: 20,
        status: undefined,
        sort: '-createdAt',
      });
    });

    it('renders error state for exercises', () => {
      setupDefaultMocks({
        exercises: {
          data: undefined,
          isLoading: false,
          error: new Error('Failed to load exercises'),
        },
      });

      render(<OptionPlansPage />);
      fireEvent.click(screen.getByText('Exercises'));

      expect(screen.getByText('Failed to load exercises')).toBeInTheDocument();
    });

    // --- Confirm Exercise tests ---

    it('renders confirm button for PENDING_PAYMENT exercises', () => {
      renderExercisesTab();

      const confirmButtons = screen.getAllByTitle('Confirm Payment');
      expect(confirmButtons).toHaveLength(1);
    });

    it('does not render confirm button for COMPLETED exercises', () => {
      setupDefaultMocks({
        exercises: {
          data: {
            data: [mockExercises[1]], // COMPLETED exercise only
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
          isLoading: false,
        },
      });
      render(<OptionPlansPage />);
      fireEvent.click(screen.getByText('Exercises'));

      expect(screen.queryByTitle('Confirm Payment')).not.toBeInTheDocument();
    });

    it('opens confirm exercise dialog on confirm click', () => {
      renderExercisesTab();

      const confirmButton = screen.getByTitle('Confirm Payment');
      fireEvent.click(confirmButton);

      expect(screen.getByText('Confirm Exercise')).toBeInTheDocument();
      expect(screen.getByText('Confirm that payment has been received.')).toBeInTheDocument();
    });

    it('shows exercise details in confirm dialog', () => {
      renderExercisesTab();

      const confirmButton = screen.getByTitle('Confirm Payment');
      fireEvent.click(confirmButton);

      expect(screen.getAllByText('Payment Reference').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('PIX-20260115').length).toBeGreaterThanOrEqual(1);
    });

    it('shows payment notes textarea in confirm dialog', () => {
      renderExercisesTab();

      const confirmButton = screen.getByTitle('Confirm Payment');
      fireEvent.click(confirmButton);

      expect(screen.getByText('Payment Notes')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. Bank transfer received')).toBeInTheDocument();
    });

    it('calls confirm exercise mutation when dialog confirmed', async () => {
      const mockConfirmMutateAsync = jest.fn().mockResolvedValue(undefined);
      setupDefaultMocks({
        confirmExercise: { mutateAsync: mockConfirmMutateAsync, isPending: false },
      });

      render(<OptionPlansPage />);
      fireEvent.click(screen.getByText('Exercises'));

      const confirmButton = screen.getByTitle('Confirm Payment');
      fireEvent.click(confirmButton);

      // Click confirm payment button in dialog
      const dialogConfirmButton = screen.getByText('Confirm Payment');
      // The button in dialog (not the table action button)
      const dialogButton = screen.getAllByText('Confirm Payment').find(
        (el) => el.tagName === 'BUTTON' && el.closest('.fixed'),
      );
      fireEvent.click(dialogButton!);

      await waitFor(() => {
        expect(mockConfirmMutateAsync).toHaveBeenCalledWith({
          exerciseId: 'exercise-1',
          paymentNotes: undefined,
        });
      });
    });

    it('passes payment notes to confirm mutation', async () => {
      const mockConfirmMutateAsync = jest.fn().mockResolvedValue(undefined);
      setupDefaultMocks({
        confirmExercise: { mutateAsync: mockConfirmMutateAsync, isPending: false },
      });

      render(<OptionPlansPage />);
      fireEvent.click(screen.getByText('Exercises'));

      const confirmButton = screen.getByTitle('Confirm Payment');
      fireEvent.click(confirmButton);

      // Type payment notes
      const textarea = screen.getByPlaceholderText('e.g. Bank transfer received');
      fireEvent.change(textarea, { target: { value: 'PIX received' } });

      // Click confirm
      const dialogButton = screen.getAllByText('Confirm Payment').find(
        (el) => el.tagName === 'BUTTON' && el.closest('.fixed'),
      );
      fireEvent.click(dialogButton!);

      await waitFor(() => {
        expect(mockConfirmMutateAsync).toHaveBeenCalledWith({
          exerciseId: 'exercise-1',
          paymentNotes: 'PIX received',
        });
      });
    });

    it('closes confirm dialog when backdrop clicked', () => {
      renderExercisesTab();

      const confirmButton = screen.getByTitle('Confirm Payment');
      fireEvent.click(confirmButton);

      expect(screen.getByText('Confirm Exercise')).toBeInTheDocument();

      // Click backdrop
      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);

      expect(screen.queryByText('Confirm Exercise')).not.toBeInTheDocument();
    });

    it('closes confirm dialog when cancel button clicked', () => {
      renderExercisesTab();

      const confirmButton = screen.getByTitle('Confirm Payment');
      fireEvent.click(confirmButton);

      expect(screen.getByText('Confirm Exercise')).toBeInTheDocument();

      // Click cancel button in dialog
      const cancelButtons = screen.getAllByText('Cancel');
      const dialogCancelButton = cancelButtons.find(
        (el) => el.tagName === 'BUTTON' && el.closest('.fixed'),
      );
      fireEvent.click(dialogCancelButton!);

      expect(screen.queryByText('Confirm Exercise')).not.toBeInTheDocument();
    });
  });
});
