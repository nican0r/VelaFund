import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OptionPlanDetailPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const keys: Record<string, Record<string, string>> = {
      optionPlans: {
        'planDetail.back': 'Back to Option Plans',
        'planDetail.error': 'Error loading option plan.',
        'planDetail.notFound': 'Option plan not found.',
        'planDetail.newGrant': 'New Grant',
        'planDetail.closePlan': 'Close Plan',
        'planDetail.planInformation': 'Plan Information',
        'planDetail.planTerms': 'Plan Terms',
        'planDetail.name': 'Plan Name',
        'planDetail.shareClass': 'Share Class',
        'planDetail.status': 'Status',
        'planDetail.boardApprovalDate': 'Board Approval Date',
        'planDetail.createdAt': 'Created on',
        'planDetail.terminationPolicy': 'Termination Policy',
        'planDetail.exerciseWindow': 'Exercise Window',
        'planDetail.exerciseWindowDays': `${params?.days ?? ''} days`,
        'planDetail.notes': 'Notes',
        'planDetail.tabGrants': 'Grants',
        'planDetail.tabDetails': 'Details',
        'planDetail.emptyGrants': 'No grants in this plan.',
        'confirm.closeTitle': 'Close Plan',
        'confirm.closeDescription': 'Are you sure? New grants will not be allowed.',
        'confirm.close': 'Close Plan',
        'confirm.cancelTitle': 'Cancel Grant',
        'confirm.cancelDescription': 'Are you sure you want to cancel this grant?',
        'confirm.cancel': 'Cancel Grant',
        'planStatus.active': 'Active',
        'planStatus.closed': 'Closed',
        'grantStatus.active': 'Active',
        'grantStatus.exercised': 'Exercised',
        'grantStatus.cancelled': 'Cancelled',
        'grantStatus.expired': 'Expired',
        'terminationPolicy.forfeiture': 'Forfeiture',
        'terminationPolicy.acceleration': 'Acceleration',
        'terminationPolicy.proRata': 'Pro-rata',
        'table.totalPool': 'Total Pool',
        'table.granted': 'Granted',
        'table.available': 'Available',
        'table.exercised': 'Exercised',
        'table.employee': 'Employee',
        'table.grantDate': 'Grant Date',
        'table.quantity': 'Quantity',
        'table.strikePrice': 'Strike Price',
        'table.vesting': 'Vesting',
        'table.status': 'Status',
        'table.cliffMonths': `${params?.months ?? ''}m cliff`,
        actions: 'Actions',
        'pool.utilization': 'Pool Utilization',
        'pool.granted': 'Granted',
        'pool.available': 'Available',
        'filter.allStatuses': 'All statuses',
        'pagination.showing': `Showing ${params?.from ?? ''} to ${params?.to ?? ''} of ${params?.total ?? ''}`,
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
        'pagination.page': 'Page',
        'pagination.of': 'of',
      },
    };
    return keys[namespace]?.[key] ?? key;
  },
}));

// Mock next/navigation
const mockParams = { id: 'plan-1' };
jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
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
const mockUseOptionPlan = jest.fn();
const mockUseOptionGrants = jest.fn();
const mockUseClosePlan = jest.fn();
const mockUseCancelGrant = jest.fn();
jest.mock('@/hooks/use-option-plans', () => ({
  useOptionPlan: (...args: unknown[]) => mockUseOptionPlan(...args),
  useOptionGrants: (...args: unknown[]) => mockUseOptionGrants(...args),
  useClosePlan: (...args: unknown[]) => mockUseClosePlan(...args),
  useCancelGrant: (...args: unknown[]) => mockUseCancelGrant(...args),
}));

// --- Mock data ---

const mockPlan = {
  id: 'plan-1',
  companyId: 'c1',
  name: 'ESOP 2026',
  shareClassId: 'sc-1',
  totalPoolSize: '100000',
  totalGranted: '60000',
  totalExercised: '10000',
  status: 'ACTIVE' as const,
  boardApprovalDate: '2026-01-15T00:00:00.000Z',
  terminationPolicy: 'FORFEITURE' as const,
  exerciseWindowDays: 90,
  notes: 'Company-wide stock option plan',
  closedAt: null,
  createdBy: 'user-1',
  createdAt: '2026-01-10T10:00:00.000Z',
  updatedAt: '2026-06-15T12:00:00.000Z',
  shareClass: { id: 'sc-1', className: 'ON', type: 'COMMON_SHARES' },
  optionsAvailable: '40000',
  activeGrantCount: 3,
};

const mockClosedPlan = {
  ...mockPlan,
  id: 'plan-2',
  name: 'Old Plan',
  status: 'CLOSED' as const,
  closedAt: '2026-02-01T00:00:00.000Z',
};

const mockGrants = [
  {
    id: 'grant-1',
    companyId: 'c1',
    planId: 'plan-1',
    shareholderId: null,
    employeeName: 'Maria Santos',
    employeeEmail: 'maria@example.com',
    quantity: '30000',
    strikePrice: '5.00',
    exercised: '5000',
    status: 'ACTIVE' as const,
    grantDate: '2026-02-01T00:00:00.000Z',
    expirationDate: '2036-02-01T00:00:00.000Z',
    cliffMonths: 12,
    vestingDurationMonths: 48,
    vestingFrequency: 'MONTHLY' as const,
    cliffPercentage: '25.0',
    accelerationOnCoc: true,
    terminatedAt: null,
    notes: null,
    createdBy: 'user-1',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    plan: { id: 'plan-1', name: 'ESOP 2026' },
  },
  {
    id: 'grant-2',
    companyId: 'c1',
    planId: 'plan-1',
    shareholderId: null,
    employeeName: 'Pedro Alves',
    employeeEmail: 'pedro@example.com',
    quantity: '20000',
    strikePrice: '5.00',
    exercised: '0',
    status: 'ACTIVE' as const,
    grantDate: '2026-03-01T00:00:00.000Z',
    expirationDate: '2036-03-01T00:00:00.000Z',
    cliffMonths: 12,
    vestingDurationMonths: 48,
    vestingFrequency: 'QUARTERLY' as const,
    cliffPercentage: '25.0',
    accelerationOnCoc: false,
    terminatedAt: null,
    notes: null,
    createdBy: 'user-1',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    plan: { id: 'plan-1', name: 'ESOP 2026' },
  },
  {
    id: 'grant-3',
    companyId: 'c1',
    planId: 'plan-1',
    shareholderId: null,
    employeeName: 'Ana Ferreira',
    employeeEmail: 'ana@example.com',
    quantity: '10000',
    strikePrice: '5.00',
    exercised: '10000',
    status: 'EXERCISED' as const,
    grantDate: '2026-01-15T00:00:00.000Z',
    expirationDate: '2036-01-15T00:00:00.000Z',
    cliffMonths: 12,
    vestingDurationMonths: 48,
    vestingFrequency: 'MONTHLY' as const,
    cliffPercentage: '25.0',
    accelerationOnCoc: false,
    terminatedAt: null,
    notes: null,
    createdBy: 'user-1',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    plan: { id: 'plan-1', name: 'ESOP 2026' },
  },
];

// --- Helpers ---

function setupDefaults() {
  mockUseCompany.mockReturnValue({
    selectedCompany: { id: 'c1', name: 'Test Corp' },
    isLoading: false,
  });
  mockUseOptionPlan.mockReturnValue({
    data: mockPlan,
    isLoading: false,
    error: null,
  });
  mockUseOptionGrants.mockReturnValue({
    data: {
      data: mockGrants,
      meta: { total: 3, page: 1, limit: 10, totalPages: 1 },
    },
    isLoading: false,
  });
  mockUseClosePlan.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  });
  mockUseCancelGrant.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaults();
});

// --- Tests ---

describe('OptionPlanDetailPage', () => {
  // --- Rendering ---

  it('renders plan name and status badge', () => {
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('ESOP 2026')).toBeInTheDocument();
    // "Active" appears in status badge, grant badges, and filter dropdown
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders share class badge', () => {
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('ON')).toBeInTheDocument();
  });

  it('renders back link to options page', () => {
    render(<OptionPlanDetailPage />);
    const backLink = screen.getByText('Back to Option Plans');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/options');
  });

  it('renders 4 stat cards with correct values', () => {
    render(<OptionPlanDetailPage />);
    // Total Pool (formatted pt-BR)
    expect(screen.getByText('Total Pool')).toBeInTheDocument();
    expect(screen.getByText('100.000')).toBeInTheDocument();
    // Granted — appears in stat card and pool bar
    const grantedLabels = screen.getAllByText('Granted');
    expect(grantedLabels.length).toBeGreaterThanOrEqual(1);
    // 60.000 may appear in stat card and table cells
    const grantedValues = screen.getAllByText('60.000');
    expect(grantedValues.length).toBeGreaterThanOrEqual(1);
    // Available — appears in stat card and pool bar
    const availableLabels = screen.getAllByText('Available');
    expect(availableLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('40.000')).toBeInTheDocument();
    // Exercised — appears in stat card, filter dropdown, table header, and grant badge
    const exercisedLabels = screen.getAllByText('Exercised');
    expect(exercisedLabels.length).toBeGreaterThanOrEqual(1);
    // 10.000 appears in stat card and table cells (quantity/exercised)
    const exercisedValues = screen.getAllByText('10.000');
    expect(exercisedValues.length).toBeGreaterThanOrEqual(1);
  });

  it('renders pool utilization bar with percentage', () => {
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('Pool Utilization')).toBeInTheDocument();
    // 60000/100000 = 60%
    expect(screen.getByText('60,0%')).toBeInTheDocument();
  });

  it('renders grants and details tabs', () => {
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('Grants')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  // --- Grants Tab ---

  it('renders grants table with employee data on default tab', () => {
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
    expect(screen.getByText('Pedro Alves')).toBeInTheDocument();
    expect(screen.getByText('pedro@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ana Ferreira')).toBeInTheDocument();
  });

  it('renders grant quantities formatted in pt-BR', () => {
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('30.000')).toBeInTheDocument();
    expect(screen.getByText('20.000')).toBeInTheDocument();
  });

  it('renders grant status badges', () => {
    render(<OptionPlanDetailPage />);
    // 2 active grants + plan status badge + detail tab status badge
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('renders grant strike price as BRL currency', () => {
    render(<OptionPlanDetailPage />);
    const currencyValues = screen.getAllByText('R$ 5,00');
    expect(currencyValues.length).toBeGreaterThan(0);
  });

  it('shows cancel button only for active grants', () => {
    render(<OptionPlanDetailPage />);
    // There are 2 ACTIVE grants and 1 EXERCISED — should be 2 cancel buttons
    // We check for view links (3 = all grants) and XCircle buttons
    const viewLinks = screen.getAllByTitle('View');
    expect(viewLinks).toHaveLength(3);
    const cancelButtons = screen.getAllByTitle('Cancel');
    expect(cancelButtons).toHaveLength(2);
  });

  it('renders status filter dropdown in grants tab', () => {
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('All statuses')).toBeInTheDocument();
  });

  it('shows empty state when no grants exist', () => {
    mockUseOptionGrants.mockReturnValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      },
      isLoading: false,
    });
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('No grants in this plan.')).toBeInTheDocument();
  });

  it('renders New Grant links for active plan', () => {
    render(<OptionPlanDetailPage />);
    const newGrantLinks = screen.getAllByText('New Grant');
    expect(newGrantLinks.length).toBeGreaterThanOrEqual(1);
    // At least one should link to the create grant page with planId
    const links = newGrantLinks.map(el => el.closest('a')).filter(Boolean);
    const hasCorrectLink = links.some(link =>
      link?.getAttribute('href')?.includes(`planId=${mockPlan.id}`)
    );
    expect(hasCorrectLink).toBe(true);
  });

  // --- Details Tab ---

  it('switches to details tab and shows plan information', () => {
    render(<OptionPlanDetailPage />);
    const detailsTab = screen.getByText('Details');
    fireEvent.click(detailsTab);

    expect(screen.getByText('Plan Information')).toBeInTheDocument();
    expect(screen.getByText('Plan Terms')).toBeInTheDocument();
  });

  it('shows plan details: name, share class, board approval date', () => {
    render(<OptionPlanDetailPage />);
    const detailsTab = screen.getByText('Details');
    fireEvent.click(detailsTab);

    expect(screen.getByText('Plan Name')).toBeInTheDocument();
    expect(screen.getByText('Share Class')).toBeInTheDocument();
    expect(screen.getByText('Board Approval Date')).toBeInTheDocument();
    expect(screen.getByText('Created on')).toBeInTheDocument();
  });

  it('shows plan terms: termination policy, exercise window, notes', () => {
    render(<OptionPlanDetailPage />);
    const detailsTab = screen.getByText('Details');
    fireEvent.click(detailsTab);

    expect(screen.getByText('Termination Policy')).toBeInTheDocument();
    expect(screen.getByText('Forfeiture')).toBeInTheDocument();
    expect(screen.getByText('Exercise Window')).toBeInTheDocument();
    expect(screen.getByText('90 days')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Company-wide stock option plan')).toBeInTheDocument();
  });

  // --- Close Plan Action ---

  it('shows close plan button for active plans', () => {
    render(<OptionPlanDetailPage />);
    const closePlanButtons = screen.getAllByText('Close Plan');
    expect(closePlanButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show close plan button for closed plans', () => {
    mockUseOptionPlan.mockReturnValue({
      data: mockClosedPlan,
      isLoading: false,
      error: null,
    });
    render(<OptionPlanDetailPage />);
    // The "Closed" status badge should be visible
    const closedBadges = screen.getAllByText('Closed');
    expect(closedBadges.length).toBeGreaterThanOrEqual(1);
    // No "Close Plan" button should exist for closed plans
    const closePlanButtons = screen.queryAllByText('Close Plan');
    expect(closePlanButtons).toHaveLength(0);
  });

  it('does not show New Grant buttons for closed plans', () => {
    mockUseOptionPlan.mockReturnValue({
      data: mockClosedPlan,
      isLoading: false,
      error: null,
    });
    render(<OptionPlanDetailPage />);
    expect(screen.queryByText('New Grant')).not.toBeInTheDocument();
  });

  it('opens close plan confirmation dialog', () => {
    render(<OptionPlanDetailPage />);
    // Click the close plan button in header (first occurrence)
    const closePlanButtons = screen.getAllByText('Close Plan');
    fireEvent.click(closePlanButtons[0]);
    expect(screen.getByText('Are you sure? New grants will not be allowed.')).toBeInTheDocument();
  });

  it('calls closePlan mutation when confirmed', async () => {
    const mockCloseMutate = jest.fn().mockResolvedValue({});
    mockUseClosePlan.mockReturnValue({
      mutateAsync: mockCloseMutate,
      isPending: false,
    });
    render(<OptionPlanDetailPage />);
    // Click close plan button in header
    const closePlanButtons = screen.getAllByText('Close Plan');
    fireEvent.click(closePlanButtons[0]);
    // Click confirm in dialog (last occurrence after dialog opens)
    const allCloseButtons = screen.getAllByText('Close Plan');
    const dialogConfirm = allCloseButtons[allCloseButtons.length - 1];
    fireEvent.click(dialogConfirm);
    await waitFor(() => {
      expect(mockCloseMutate).toHaveBeenCalledWith('plan-1');
    });
  });

  // --- Cancel Grant Action ---

  it('opens cancel grant confirmation dialog', () => {
    render(<OptionPlanDetailPage />);
    const cancelButtons = screen.getAllByTitle('Cancel');
    fireEvent.click(cancelButtons[0]);
    expect(screen.getByText('Are you sure you want to cancel this grant?')).toBeInTheDocument();
  });

  it('calls cancelGrant mutation when confirmed', async () => {
    const mockCancelMutate = jest.fn().mockResolvedValue({});
    mockUseCancelGrant.mockReturnValue({
      mutateAsync: mockCancelMutate,
      isPending: false,
    });
    render(<OptionPlanDetailPage />);
    const cancelButtons = screen.getAllByTitle('Cancel');
    fireEvent.click(cancelButtons[0]); // Cancel first active grant
    // Confirm in dialog — "Cancel Grant" appears as the dialog confirm button
    const cancelGrantButtons = screen.getAllByText('Cancel Grant');
    const dialogConfirm = cancelGrantButtons[cancelGrantButtons.length - 1];
    fireEvent.click(dialogConfirm);
    await waitFor(() => {
      expect(mockCancelMutate).toHaveBeenCalledWith('grant-1');
    });
  });

  // --- Loading/Error/Not Found states ---

  it('shows skeleton when loading', () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 'c1', name: 'Test Corp' },
      isLoading: true,
    });
    const { container } = render(<OptionPlanDetailPage />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows skeleton when plan is loading', () => {
    mockUseOptionPlan.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    const { container } = render(<OptionPlanDetailPage />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows error state when plan fetch fails', () => {
    mockUseOptionPlan.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    });
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('Error loading option plan.')).toBeInTheDocument();
    expect(screen.getByText('Back to Option Plans')).toBeInTheDocument();
  });

  it('shows not found state when plan is null', () => {
    mockUseOptionPlan.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('Option plan not found.')).toBeInTheDocument();
  });

  it('shows no-company state when no company selected', () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: null,
      isLoading: false,
    });
    render(<OptionPlanDetailPage />);
    // Should show the no-company placeholder
    expect(screen.queryByText('ESOP 2026')).not.toBeInTheDocument();
  });

  // --- Pagination ---

  it('shows pagination when multiple pages of grants', () => {
    mockUseOptionGrants.mockReturnValue({
      data: {
        data: mockGrants,
        meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
      },
      isLoading: false,
    });
    render(<OptionPlanDetailPage />);
    expect(screen.getByText('Showing 1 to 10 of 25')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('does not show pagination for single page', () => {
    render(<OptionPlanDetailPage />);
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  // --- Status filter ---

  it('changes grant status filter', () => {
    render(<OptionPlanDetailPage />);
    const select = screen.getByDisplayValue('All statuses');
    fireEvent.change(select, { target: { value: 'ACTIVE' } });
    // Verify the hook was called with the new filter
    expect(mockUseOptionGrants).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ status: 'ACTIVE' }),
    );
  });

  // --- View grant links ---

  it('renders view links pointing to grant detail pages', () => {
    render(<OptionPlanDetailPage />);
    const viewLinks = screen.getAllByTitle('View');
    expect(viewLinks).toHaveLength(3);
    expect(viewLinks[0].closest('a')).toHaveAttribute(
      'href',
      '/dashboard/options/grants/grant-1',
    );
  });

  // --- Pool utilization computed from optionsAvailable ---

  it('computes available from totalPoolSize - totalGranted when optionsAvailable is missing', () => {
    const planWithoutComputed = { ...mockPlan, optionsAvailable: undefined, activeGrantCount: undefined };
    mockUseOptionPlan.mockReturnValue({
      data: planWithoutComputed,
      isLoading: false,
      error: null,
    });
    render(<OptionPlanDetailPage />);
    // Available should still be 40,000 (100000 - 60000)
    expect(screen.getByText('40.000')).toBeInTheDocument();
  });
});
