import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OptionGrantDetailPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const keys: Record<string, Record<string, string>> = {
      optionPlans: {
        'grantDetail.back': 'Back to Options',
        'grantDetail.backToPlan': 'Back to Plan',
        'grantDetail.cancelGrant': 'Cancel Grant',
        'grantDetail.cancelGrantTitle': 'Cancel Option Grant',
        'grantDetail.cancelGrantDescription': 'Are you sure you want to cancel this grant?',
        'grantDetail.employee': 'Employee',
        'grantDetail.email': 'Email',
        'grantDetail.plan': 'Plan',
        'grantDetail.status': 'Status',
        'grantDetail.grantDate': 'Grant Date',
        'grantDetail.expirationDate': 'Expiration Date',
        'grantDetail.shareholder': 'Shareholder',
        'grantDetail.terminatedAt': 'Cancelled at',
        'grantDetail.createdAt': 'Created at',
        'grantDetail.grantInformation': 'Grant Information',
        'grantDetail.grantTerms': 'Grant Terms',
        'grantDetail.quantity': 'Quantity',
        'grantDetail.strikePrice': 'Strike Price',
        'grantDetail.totalValue': 'Total Value',
        'grantDetail.cliffMonths': 'Cliff (months)',
        'grantDetail.vestingDuration': 'Vesting Duration',
        'grantDetail.vestingDurationValue': `${params?.months ?? ''} months`,
        'grantDetail.vestingFrequency': 'Vesting Frequency',
        'grantDetail.terminationPolicy': 'Termination Policy',
        'grantDetail.notes': 'Notes',
        'grantDetail.tabOverview': 'Overview',
        'grantDetail.tabVesting': 'Vesting',
        'grantDetail.tabExercises': 'Exercises',
        'grantDetail.statsGranted': 'Granted',
        'grantDetail.statsVested': 'Vested',
        'grantDetail.statsExercisable': 'Exercisable',
        'grantDetail.statsExercised': 'Exercised',
        'grantDetail.statsVestingProgress': 'Vesting Progress',
        'grantDetail.error': 'Error loading grant details.',
        'grantDetail.notFound': 'Grant not found.',
        'grantDetail.vestingProgress': 'Vesting Progress',
        'grantDetail.vestedQuantity': 'Vested',
        'grantDetail.cliffDate': 'Cliff Date',
        'grantDetail.cliffMet': 'Cliff Met',
        'grantDetail.nextVesting': 'Next Vesting',
        'grantDetail.nextVestingAmount': 'Next Vesting Amount',
        'grantDetail.yes': 'Yes',
        'grantDetail.no': 'No',
        'grantDetail.vestingSchedule': 'Vesting Schedule',
        'grantDetail.scheduleDate': 'Date',
        'grantDetail.scheduleType': 'Type',
        'grantDetail.scheduleQuantity': 'Quantity',
        'grantDetail.scheduleCumulative': 'Cumulative',
        'grantDetail.vestingPercentage': 'Vesting (%)',
        'grantDetail.scheduleTypeCliff': 'Cliff',
        'grantDetail.scheduleTypeMonthly': 'Monthly',
        'grantDetail.scheduleTypeQuarterly': 'Quarterly',
        'grantDetail.scheduleTypeAnnual': 'Annual',
        'grantDetail.emptyExercises': 'No exercises found for this grant.',
        'grantDetail.exerciseDate': 'Exercise Date',
        'grantDetail.totalCost': 'Total Cost',
        'grantDetail.paymentReference': 'Payment Reference',
        'grantStatus.active': 'Active',
        'grantStatus.exercised': 'Exercised',
        'grantStatus.cancelled': 'Cancelled',
        'grantStatus.expired': 'Expired',
        'exerciseStatus.pendingPayment': 'Pending Payment',
        'exerciseStatus.paymentConfirmed': 'Payment Confirmed',
        'exerciseStatus.sharesIssued': 'Shares Issued',
        'exerciseStatus.completed': 'Completed',
        'exerciseStatus.cancelled': 'Cancelled',
        'frequency.monthly': 'Monthly',
        'frequency.quarterly': 'Quarterly',
        'frequency.annually': 'Annually',
        'terminationPolicy.forfeiture': 'Forfeiture',
        'terminationPolicy.acceleration': 'Acceleration',
        'terminationPolicy.proRata': 'Pro-rata',
        'confirm.cancelExerciseTitle': 'Cancel Exercise',
        'confirm.cancelExerciseDescription': 'Are you sure you want to cancel this exercise?',
        'confirm.cancelExercise': 'Cancel Exercise',
        actions: 'Actions',
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
const mockParams = { id: 'grant-1' };
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
const mockUseOptionGrant = jest.fn();
const mockUseGrantVestingSchedule = jest.fn();
const mockUseOptionExercises = jest.fn();
const mockUseCancelGrant = jest.fn();
const mockUseCancelExercise = jest.fn();
jest.mock('@/hooks/use-option-plans', () => ({
  useOptionGrant: (...args: unknown[]) => mockUseOptionGrant(...args),
  useGrantVestingSchedule: (...args: unknown[]) => mockUseGrantVestingSchedule(...args),
  useOptionExercises: (...args: unknown[]) => mockUseOptionExercises(...args),
  useCancelGrant: (...args: unknown[]) => mockUseCancelGrant(...args),
  useCancelExercise: (...args: unknown[]) => mockUseCancelExercise(...args),
}));

// --- Mock data ---

const mockGrant = {
  id: 'grant-1',
  companyId: 'c1',
  planId: 'plan-1',
  shareholderId: 'sh-1',
  employeeName: 'Maria Santos',
  employeeEmail: 'maria@example.com',
  quantity: '10000',
  strikePrice: '5.00',
  exercised: '2000',
  status: 'ACTIVE' as const,
  grantDate: '2026-01-15T00:00:00.000Z',
  expirationDate: '2036-01-15T00:00:00.000Z',
  cliffMonths: 12,
  vestingDurationMonths: 48,
  vestingFrequency: 'MONTHLY' as const,
  cliffPercentage: '25.0',
  accelerationOnCoc: true,
  terminatedAt: null,
  notes: 'CTO stock options',
  createdBy: 'user-1',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
  plan: {
    id: 'plan-1',
    name: 'ESOP 2026',
    terminationPolicy: 'FORFEITURE',
    exerciseWindowDays: 90,
  },
  shareholder: { id: 'sh-1', name: 'Maria Santos' },
  vesting: {
    vestedQuantity: '5000',
    unvestedQuantity: '5000',
    exercisableQuantity: '3000',
    vestingPercentage: '50.00',
    cliffDate: '2027-01-15T00:00:00.000Z',
    cliffMet: true,
    nextVestingDate: '2027-02-15T00:00:00.000Z',
    nextVestingAmount: '208',
  },
};

const mockCancelledGrant = {
  ...mockGrant,
  id: 'grant-2',
  status: 'CANCELLED' as const,
  terminatedAt: '2026-06-01T00:00:00.000Z',
  vesting: {
    vestedQuantity: '0',
    unvestedQuantity: '10000',
    exercisableQuantity: '0',
    vestingPercentage: '0.00',
    cliffDate: '2027-01-15T00:00:00.000Z',
    cliffMet: false,
    nextVestingDate: null,
    nextVestingAmount: null,
  },
};

const mockVestingSchedule = {
  grantId: 'grant-1',
  shareholderName: 'Maria Santos',
  totalOptions: '10000',
  vestedOptions: '5000',
  unvestedOptions: '5000',
  exercisedOptions: '2000',
  exercisableOptions: '3000',
  vestingPercentage: '50.00',
  nextVestingDate: '2027-02-15T00:00:00.000Z',
  nextVestingAmount: '208',
  cliffDate: '2027-01-15T00:00:00.000Z',
  cliffMet: true,
  schedule: [
    {
      date: '2027-01-15T00:00:00.000Z',
      quantity: '2500',
      cumulative: '2500',
      type: 'CLIFF' as const,
    },
    {
      date: '2027-02-15T00:00:00.000Z',
      quantity: '208',
      cumulative: '2708',
      type: 'MONTHLY' as const,
    },
    {
      date: '2027-03-15T00:00:00.000Z',
      quantity: '208',
      cumulative: '2916',
      type: 'MONTHLY' as const,
    },
  ],
};

const mockExercises = [
  {
    id: 'ex-1',
    grantId: 'grant-1',
    quantity: '1000',
    totalCost: '5000.00',
    paymentReference: 'EX-2026-ABC123',
    status: 'COMPLETED' as const,
    confirmedBy: 'admin-1',
    confirmedAt: '2026-06-15T00:00:00.000Z',
    cancelledAt: null,
    blockchainTxHash: null,
    createdBy: 'user-1',
    createdAt: '2026-06-10T10:00:00.000Z',
    updatedAt: '2026-06-15T10:00:00.000Z',
  },
  {
    id: 'ex-2',
    grantId: 'grant-1',
    quantity: '500',
    totalCost: '2500.00',
    paymentReference: 'EX-2026-DEF456',
    status: 'PENDING_PAYMENT' as const,
    confirmedBy: null,
    confirmedAt: null,
    cancelledAt: null,
    blockchainTxHash: null,
    createdBy: 'user-1',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
  },
];

// --- Helpers ---

function setupDefaults() {
  mockUseCompany.mockReturnValue({
    selectedCompany: { id: 'c1', name: 'Test Corp' },
    isLoading: false,
  });
  mockUseOptionGrant.mockReturnValue({
    data: mockGrant,
    isLoading: false,
    error: null,
  });
  mockUseGrantVestingSchedule.mockReturnValue({
    data: mockVestingSchedule,
    isLoading: false,
  });
  mockUseOptionExercises.mockReturnValue({
    data: {
      data: mockExercises,
      meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
    },
    isLoading: false,
  });
  mockUseCancelGrant.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  });
  mockUseCancelExercise.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaults();
});

// --- Tests ---

describe('OptionGrantDetailPage', () => {
  // --- Rendering ---

  it('renders employee name and status badge', () => {
    render(<OptionGrantDetailPage />);
    const names = screen.getAllByText('Maria Santos');
    expect(names.length).toBeGreaterThanOrEqual(1);
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders plan name badge', () => {
    render(<OptionGrantDetailPage />);
    const planNames = screen.getAllByText('ESOP 2026');
    expect(planNames.length).toBeGreaterThanOrEqual(1);
  });

  it('renders back link to plan detail page', () => {
    render(<OptionGrantDetailPage />);
    const backLink = screen.getByText('Back to Plan');
    expect(backLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/options/plans/plan-1',
    );
  });

  it('renders 4 stat cards with correct values', () => {
    render(<OptionGrantDetailPage />);
    expect(screen.getByText('Granted')).toBeInTheDocument();
    // 10000 formatted as 10.000 may appear in stat card and quantity InfoRow
    const grantedValues = screen.getAllByText('10.000');
    expect(grantedValues.length).toBeGreaterThanOrEqual(1);
    // Vested stat card
    const vestedLabels = screen.getAllByText('Vested');
    expect(vestedLabels.length).toBeGreaterThanOrEqual(1);
    const vestedValues = screen.getAllByText('5.000');
    expect(vestedValues.length).toBeGreaterThanOrEqual(1);
    // Exercisable
    expect(screen.getByText('Exercisable')).toBeInTheDocument();
    expect(screen.getByText('3.000')).toBeInTheDocument();
    // Exercised
    const exercisedLabels = screen.getAllByText('Exercised');
    expect(exercisedLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2.000')).toBeInTheDocument();
  });

  it('renders vesting progress bar with percentage', () => {
    render(<OptionGrantDetailPage />);
    const progressLabels = screen.getAllByText('Vesting Progress');
    expect(progressLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('50,0%')).toBeInTheDocument();
  });

  it('renders three tabs: Overview, Vesting, Exercises', () => {
    render(<OptionGrantDetailPage />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Vesting')).toBeInTheDocument();
    expect(screen.getByText('Exercises')).toBeInTheDocument();
  });

  // --- Overview Tab ---

  it('renders overview tab by default with grant information', () => {
    render(<OptionGrantDetailPage />);
    expect(screen.getByText('Grant Information')).toBeInTheDocument();
    expect(screen.getByText('Grant Terms')).toBeInTheDocument();
  });

  it('shows employee name and email in grant info', () => {
    render(<OptionGrantDetailPage />);
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
  });

  it('shows plan link in grant info', () => {
    render(<OptionGrantDetailPage />);
    // Plan name appears both in badge and info row
    const planLinks = screen.getAllByText('ESOP 2026');
    const planLink = planLinks.find((el) => el.closest('a')?.getAttribute('href')?.includes('plans/'));
    expect(planLink).toBeDefined();
  });

  it('shows grant dates formatted in pt-BR', () => {
    render(<OptionGrantDetailPage />);
    // Grant date and createdAt both 2026-01-15 → 15/01/2026 (appears twice)
    const grantDates = screen.getAllByText('15/01/2026');
    expect(grantDates.length).toBeGreaterThanOrEqual(1);
    // Expiration date 2036-01-15 → 15/01/2036
    expect(screen.getByText('15/01/2036')).toBeInTheDocument();
  });

  it('shows strike price as BRL currency', () => {
    render(<OptionGrantDetailPage />);
    const currencyValues = screen.getAllByText('R$ 5,00');
    expect(currencyValues.length).toBeGreaterThan(0);
  });

  it('shows total value calculated from quantity * strikePrice', () => {
    render(<OptionGrantDetailPage />);
    // 10000 * 5.00 = 50000 → R$ 50.000,00
    expect(screen.getByText('R$ 50.000,00')).toBeInTheDocument();
  });

  it('shows vesting terms: cliff, duration, frequency', () => {
    render(<OptionGrantDetailPage />);
    expect(screen.getByText('Cliff (months)')).toBeInTheDocument();
    expect(screen.getByText('Vesting Duration')).toBeInTheDocument();
    expect(screen.getByText('48 months')).toBeInTheDocument();
    expect(screen.getByText('Vesting Frequency')).toBeInTheDocument();
  });

  it('shows shareholder name when linked', () => {
    render(<OptionGrantDetailPage />);
    // Shareholder label appears in info row
    expect(screen.getByText('Shareholder')).toBeInTheDocument();
  });

  it('shows notes when present', () => {
    render(<OptionGrantDetailPage />);
    expect(screen.getByText('CTO stock options')).toBeInTheDocument();
  });

  // --- Vesting Tab ---

  it('switches to vesting tab and shows progress data', () => {
    render(<OptionGrantDetailPage />);
    const vestingTab = screen.getByText('Vesting');
    fireEvent.click(vestingTab);

    // Should show vesting progress section from VestingTab
    const vestingProgressLabels = screen.getAllByText('Vesting Progress');
    expect(vestingProgressLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows vesting schedule table with entries', () => {
    render(<OptionGrantDetailPage />);
    const vestingTab = screen.getByText('Vesting');
    fireEvent.click(vestingTab);

    expect(screen.getByText('Vesting Schedule')).toBeInTheDocument();
    // Schedule has 3 entries
    const cliffBadges = screen.getAllByText('Cliff');
    expect(cliffBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows cliff date and cliff met status', () => {
    render(<OptionGrantDetailPage />);
    const vestingTab = screen.getByText('Vesting');
    fireEvent.click(vestingTab);

    expect(screen.getByText('Cliff Date')).toBeInTheDocument();
    expect(screen.getByText('Cliff Met')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('shows next vesting date and amount', () => {
    render(<OptionGrantDetailPage />);
    const vestingTab = screen.getByText('Vesting');
    fireEvent.click(vestingTab);

    expect(screen.getByText('Next Vesting')).toBeInTheDocument();
    expect(screen.getByText('Next Vesting Amount')).toBeInTheDocument();
  });

  it('shows vesting schedule quantities formatted', () => {
    render(<OptionGrantDetailPage />);
    const vestingTab = screen.getByText('Vesting');
    fireEvent.click(vestingTab);

    // Cliff entry: 2500 → 2.500 (appears in both quantity and cumulative columns)
    const formattedValues = screen.getAllByText('2.500');
    expect(formattedValues.length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading skeleton when vesting data is loading', () => {
    mockUseGrantVestingSchedule.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    const { container } = render(<OptionGrantDetailPage />);
    const vestingTab = screen.getByText('Vesting');
    fireEvent.click(vestingTab);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  // --- Exercises Tab ---

  it('switches to exercises tab and shows exercise table', () => {
    render(<OptionGrantDetailPage />);
    const exercisesTab = screen.getByText('Exercises');
    fireEvent.click(exercisesTab);

    // Exercise data
    expect(screen.getByText('EX-2026-ABC123')).toBeInTheDocument();
    expect(screen.getByText('EX-2026-DEF456')).toBeInTheDocument();
  });

  it('shows exercise quantities and costs formatted', () => {
    render(<OptionGrantDetailPage />);
    const exercisesTab = screen.getByText('Exercises');
    fireEvent.click(exercisesTab);

    expect(screen.getByText('1.000')).toBeInTheDocument();
    expect(screen.getByText('R$ 5.000,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 2.500,00')).toBeInTheDocument();
  });

  it('shows exercise status badges', () => {
    render(<OptionGrantDetailPage />);
    const exercisesTab = screen.getByText('Exercises');
    fireEvent.click(exercisesTab);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Pending Payment')).toBeInTheDocument();
  });

  it('shows cancel button only for pending exercises', () => {
    render(<OptionGrantDetailPage />);
    const exercisesTab = screen.getByText('Exercises');
    fireEvent.click(exercisesTab);

    // Only 1 pending exercise should have cancel button
    const cancelButtons = screen.getAllByTitle('Cancel');
    expect(cancelButtons).toHaveLength(1);
  });

  it('shows empty state when no exercises exist', () => {
    mockUseOptionExercises.mockReturnValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      },
      isLoading: false,
    });
    render(<OptionGrantDetailPage />);
    const exercisesTab = screen.getByText('Exercises');
    fireEvent.click(exercisesTab);

    expect(screen.getByText('No exercises found for this grant.')).toBeInTheDocument();
  });

  // --- Cancel Grant Action ---

  it('shows cancel grant button for active grants', () => {
    render(<OptionGrantDetailPage />);
    expect(screen.getByText('Cancel Grant')).toBeInTheDocument();
  });

  it('does not show cancel button for cancelled grants', () => {
    mockUseOptionGrant.mockReturnValue({
      data: mockCancelledGrant,
      isLoading: false,
      error: null,
    });
    render(<OptionGrantDetailPage />);
    expect(screen.queryByText('Cancel Grant')).not.toBeInTheDocument();
  });

  it('opens cancel grant confirmation dialog', () => {
    render(<OptionGrantDetailPage />);
    const cancelButton = screen.getByText('Cancel Grant');
    fireEvent.click(cancelButton);
    expect(screen.getByText('Cancel Option Grant')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to cancel this grant?')).toBeInTheDocument();
  });

  it('calls cancelGrant mutation when confirmed', async () => {
    const mockCancelMutate = jest.fn().mockResolvedValue({});
    mockUseCancelGrant.mockReturnValue({
      mutateAsync: mockCancelMutate,
      isPending: false,
    });
    render(<OptionGrantDetailPage />);
    // Open dialog
    const cancelButton = screen.getByText('Cancel Grant');
    fireEvent.click(cancelButton);
    // Confirm — there are now two "Cancel Grant" elements (button + dialog confirm)
    const allCancelButtons = screen.getAllByText('Cancel Grant');
    const dialogConfirm = allCancelButtons[allCancelButtons.length - 1];
    fireEvent.click(dialogConfirm);

    await waitFor(() => {
      expect(mockCancelMutate).toHaveBeenCalledWith('grant-1');
    });
  });

  // --- Cancel Exercise Action ---

  it('opens cancel exercise confirmation dialog', () => {
    render(<OptionGrantDetailPage />);
    const exercisesTab = screen.getByText('Exercises');
    fireEvent.click(exercisesTab);

    const cancelButtons = screen.getAllByTitle('Cancel');
    fireEvent.click(cancelButtons[0]);

    // 'Cancel Exercise' appears in both dialog title and confirm button
    const cancelTexts = screen.getAllByText('Cancel Exercise');
    expect(cancelTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Are you sure you want to cancel this exercise?')).toBeInTheDocument();
  });

  it('calls cancelExercise mutation when confirmed', async () => {
    const mockCancelExerciseMutate = jest.fn().mockResolvedValue({});
    mockUseCancelExercise.mockReturnValue({
      mutateAsync: mockCancelExerciseMutate,
      isPending: false,
    });
    render(<OptionGrantDetailPage />);
    const exercisesTab = screen.getByText('Exercises');
    fireEvent.click(exercisesTab);

    const cancelButtons = screen.getAllByTitle('Cancel');
    fireEvent.click(cancelButtons[0]);

    // Find and click confirm in dialog
    const allCancelExercise = screen.getAllByText('Cancel Exercise');
    const dialogConfirm = allCancelExercise[allCancelExercise.length - 1];
    fireEvent.click(dialogConfirm);

    await waitFor(() => {
      expect(mockCancelExerciseMutate).toHaveBeenCalledWith('ex-2');
    });
  });

  // --- Loading/Error/Not Found states ---

  it('shows skeleton when company is loading', () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: { id: 'c1', name: 'Test Corp' },
      isLoading: true,
    });
    const { container } = render(<OptionGrantDetailPage />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows skeleton when grant is loading', () => {
    mockUseOptionGrant.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    const { container } = render(<OptionGrantDetailPage />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows error state when grant fetch fails', () => {
    mockUseOptionGrant.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    });
    render(<OptionGrantDetailPage />);
    expect(screen.getByText('Error loading grant details.')).toBeInTheDocument();
    expect(screen.getByText('Back to Options')).toBeInTheDocument();
  });

  it('shows not found state when grant is null', () => {
    mockUseOptionGrant.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    render(<OptionGrantDetailPage />);
    expect(screen.getByText('Grant not found.')).toBeInTheDocument();
  });

  it('shows no-company state when no company selected', () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: null,
      isLoading: false,
    });
    render(<OptionGrantDetailPage />);
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
  });

  // --- Terminated grant ---

  it('shows terminated date for cancelled grants', () => {
    mockUseOptionGrant.mockReturnValue({
      data: mockCancelledGrant,
      isLoading: false,
      error: null,
    });
    render(<OptionGrantDetailPage />);
    expect(screen.getByText('Cancelled at')).toBeInTheDocument();
    expect(screen.getByText('01/06/2026')).toBeInTheDocument();
  });

  it('renders cancelled status badge for cancelled grants', () => {
    mockUseOptionGrant.mockReturnValue({
      data: mockCancelledGrant,
      isLoading: false,
      error: null,
    });
    render(<OptionGrantDetailPage />);
    const cancelledBadges = screen.getAllByText('Cancelled');
    expect(cancelledBadges.length).toBeGreaterThanOrEqual(1);
  });

  // --- Exercise pagination ---

  it('shows pagination when multiple pages of exercises', () => {
    mockUseOptionExercises.mockReturnValue({
      data: {
        data: mockExercises,
        meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
      },
      isLoading: false,
    });
    render(<OptionGrantDetailPage />);
    const exercisesTab = screen.getByText('Exercises');
    fireEvent.click(exercisesTab);

    expect(screen.getByText('Showing 1 to 10 of 25')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('does not show pagination for single page of exercises', () => {
    render(<OptionGrantDetailPage />);
    const exercisesTab = screen.getByText('Exercises');
    fireEvent.click(exercisesTab);

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });
});
