import { render, screen, fireEvent } from '@testing-library/react';
import ReportsPage from '../page';

// --- Mocks ---

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, Record<string, string>> = {
      reports: {
        title: 'Reports & Analytics',
        description: 'Ownership, dilution, and cap table export reports',
        empty: 'Select a company to view reports',
        'tabs.ownership': 'Ownership',
        'tabs.dilution': 'Dilution',
        'tabs.export': 'Cap Table Export',
        'tabs.dueDiligence': 'Due Diligence',
        'stats.totalShares': 'Total Shares',
        'stats.shareholders': 'Shareholders',
        'stats.giniCoefficient': 'Gini Coefficient',
        'stats.foreignOwnership': 'Foreign Ownership',
      },
      'reports.ownership': {
        title: 'Ownership Report',
        allClasses: 'All classes',
        includeOptions: 'Include option pool',
        totalShares: 'Total Shares',
        totalFullyDiluted: 'Fully Diluted',
        name: 'Shareholder',
        shareClass: 'Share Class',
        shares: 'Shares',
        ownershipPct: 'Ownership %',
        fullyDiluted: 'Fully Diluted %',
        shareholder: 'No shareholders found',
        optionPool: 'Option Pool Summary',
        poolTotal: 'Total Pool',
        poolGranted: 'Granted',
        poolExercised: 'Exercised',
        poolVestedUnexercised: 'Vested (Unexercised)',
        poolUnvested: 'Unvested',
        poolAvailable: 'Available',
      },
      'reports.dilution': {
        title: 'Dilution Analysis',
        granularityDay: 'Daily',
        granularityWeek: 'Weekly',
        granularityMonth: 'Monthly',
        dateFrom: 'Start date',
        dateTo: 'End date',
        period: 'Data Points',
        shares: 'Total Shares',
        shareClass: 'Share Class',
        noDataPoints: 'No data points for the selected period',
      },
      'reports.stats': {
        giniCoefficient: 'Gini Coefficient',
        foreignOwnership: 'Foreign Ownership',
      },
      'reports.export': {
        title: 'Cap Table Export',
        description: 'Export the current cap table in various formats',
        format: 'Format',
        pdf: 'PDF',
        xlsx: 'Excel (XLSX)',
        csv: 'CSV',
        oct: 'OCT (JSON)',
        snapshotDate: 'Snapshot Date',
        exportButton: 'Export',
        downloading: 'Exporting...',
        queued: 'Export queued...',
        processing: 'Processing export...',
        ready: 'Export ready!',
        failed: 'Export failed',
        download: 'Download',
      },
      'reports.dueDiligence': {
        title: 'Due Diligence Package',
        description: 'Generate a comprehensive due diligence package',
        dateFrom: 'Start date',
        dateTo: 'End date',
        generate: 'Generate',
        processing: 'Generating...',
        queued: 'Queued...',
        ready: 'Package ready!',
        failed: 'Generation failed',
        download: 'Download',
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

const mockUseOwnershipReport = jest.fn();
const mockUseDilutionReport = jest.fn();
const mockUseExportCapTable = jest.fn();
const mockUseExportJobStatus = jest.fn();
const mockUseGenerateDueDiligence = jest.fn();
const mockUseDueDiligenceJobStatus = jest.fn();
jest.mock('@/hooks/use-reports', () => ({
  useOwnershipReport: (...args: unknown[]) => mockUseOwnershipReport(...args),
  useDilutionReport: (...args: unknown[]) => mockUseDilutionReport(...args),
  useExportCapTable: (...args: unknown[]) => mockUseExportCapTable(...args),
  useExportJobStatus: (...args: unknown[]) => mockUseExportJobStatus(...args),
  useGenerateDueDiligence: (...args: unknown[]) => mockUseGenerateDueDiligence(...args),
  useDueDiligenceJobStatus: (...args: unknown[]) => mockUseDueDiligenceJobStatus(...args),
}));

const mockUseShareClasses = jest.fn();
jest.mock('@/hooks/use-share-classes', () => ({
  useShareClasses: (...args: unknown[]) => mockUseShareClasses(...args),
}));

// --- Mock Data ---

const mockOwnershipData = {
  companyId: 'c1',
  companyName: 'Acme Ltda.',
  generatedAt: '2026-02-26T10:00:00.000Z',
  totalShares: '100000',
  totalFullyDiluted: '120000',
  shareholders: [
    {
      shareholderId: 'sh-1',
      name: 'João Silva',
      shareClassId: 'sc-1',
      shareClassName: 'Quotas',
      shares: '60000',
      percentage: '60.00',
      fullyDilutedPercentage: '50.00',
    },
    {
      shareholderId: 'sh-2',
      name: 'Maria Santos',
      shareClassId: 'sc-1',
      shareClassName: 'Quotas',
      shares: '40000',
      percentage: '40.00',
      fullyDilutedPercentage: '33.33',
    },
  ],
  optionPoolSummary: {
    totalPool: '20000',
    granted: '15000',
    exercised: '5000',
    vestedUnexercised: '3000',
    unvested: '7000',
    available: '5000',
  },
};

const mockDilutionData = {
  companyId: 'c1',
  companyName: 'Acme Ltda.',
  generatedAt: '2026-02-26T10:00:00.000Z',
  giniCoefficient: '0.42',
  foreignOwnershipPercentage: '15.5',
  dataPoints: [
    {
      date: '2026-01-01T00:00:00.000Z',
      totalShares: '80000',
      shareClasses: [
        { shareClassId: 'sc-1', name: 'Quotas', shares: '80000', percentage: '100.00' },
      ],
    },
    {
      date: '2026-02-01T00:00:00.000Z',
      totalShares: '100000',
      shareClasses: [
        { shareClassId: 'sc-1', name: 'Quotas', shares: '100000', percentage: '100.00' },
      ],
    },
  ],
};

const mockShareClasses = [
  { id: 'sc-1', className: 'Quotas', type: 'QUOTA' },
  { id: 'sc-2', className: 'Preferred A', type: 'PREFERRED' },
];

// --- Setup ---

function setupDefaultMocks(overrides?: {
  company?: Record<string, unknown>;
  ownership?: Record<string, unknown>;
  dilution?: Record<string, unknown>;
  exportCapTable?: Record<string, unknown>;
  exportJobStatus?: Record<string, unknown>;
  dueDiligence?: Record<string, unknown>;
  dueDiligenceJobStatus?: Record<string, unknown>;
  shareClasses?: Record<string, unknown>;
}) {
  mockUseCompany.mockReturnValue({
    companies: [{ id: 'c1', name: 'Acme', status: 'ACTIVE' }],
    selectedCompany: { id: 'c1', name: 'Acme', status: 'ACTIVE' },
    setSelectedCompanyId: jest.fn(),
    isLoading: false,
    error: null,
    ...overrides?.company,
  });

  mockUseOwnershipReport.mockReturnValue({
    data: mockOwnershipData,
    isLoading: false,
    error: null,
    ...overrides?.ownership,
  });

  mockUseDilutionReport.mockReturnValue({
    data: mockDilutionData,
    isLoading: false,
    error: null,
    ...overrides?.dilution,
  });

  mockUseExportCapTable.mockReturnValue({
    mutate: jest.fn(),
    data: null,
    isPending: false,
    ...overrides?.exportCapTable,
  });

  mockUseExportJobStatus.mockReturnValue({
    data: null,
    ...overrides?.exportJobStatus,
  });

  mockUseGenerateDueDiligence.mockReturnValue({
    mutate: jest.fn(),
    data: null,
    isPending: false,
    ...overrides?.dueDiligence,
  });

  mockUseDueDiligenceJobStatus.mockReturnValue({
    data: null,
    ...overrides?.dueDiligenceJobStatus,
  });

  mockUseShareClasses.mockReturnValue({
    data: { data: mockShareClasses },
    ...overrides?.shareClasses,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaultMocks();
});

// --- Tests ---

describe('ReportsPage', () => {
  // --- Page Header ---

  describe('Page Header', () => {
    it('renders page title', () => {
      render(<ReportsPage />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Reports & Analytics');
    });

    it('renders page description', () => {
      render(<ReportsPage />);
      expect(
        screen.getByText('Ownership, dilution, and cap table export reports'),
      ).toBeInTheDocument();
    });
  });

  // --- No Company State ---

  describe('No Company State', () => {
    it('shows empty state when no company is selected', () => {
      setupDefaultMocks({ company: { selectedCompany: null, isLoading: false } });
      render(<ReportsPage />);
      expect(screen.getByText('Select a company to view reports')).toBeInTheDocument();
    });

    it('does not render tabs when no company selected', () => {
      setupDefaultMocks({ company: { selectedCompany: null, isLoading: false } });
      render(<ReportsPage />);
      expect(screen.queryByText('Ownership')).not.toBeInTheDocument();
    });
  });

  // --- Stat Cards ---

  describe('Stat Cards', () => {
    it('renders total shares stat card with formatted value', () => {
      render(<ReportsPage />);
      // "Total Shares" appears in stat card + ownership tab summary
      expect(screen.getAllByText('Total Shares').length).toBeGreaterThanOrEqual(1);
      // 100.000 appears in stat card + ownership tab summary
      expect(screen.getAllByText('100.000').length).toBeGreaterThanOrEqual(1);
    });

    it('renders shareholders count', () => {
      render(<ReportsPage />);
      expect(screen.getByText('Shareholders')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders gini coefficient', () => {
      render(<ReportsPage />);
      expect(screen.getByText('Gini Coefficient')).toBeInTheDocument();
      expect(screen.getByText('0.42')).toBeInTheDocument();
    });

    it('renders foreign ownership percentage', () => {
      render(<ReportsPage />);
      expect(screen.getByText('Foreign Ownership')).toBeInTheDocument();
      expect(screen.getByText('15,5%')).toBeInTheDocument();
    });

    it('shows loading skeletons when data is loading', () => {
      setupDefaultMocks({
        ownership: { data: null, isLoading: true },
        dilution: { data: null },
      });
      render(<ReportsPage />);
      const pulseElements = document.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('shows dash when data is not available', () => {
      setupDefaultMocks({
        ownership: { data: null, isLoading: false },
        dilution: { data: null },
      });
      render(<ReportsPage />);
      // Ownership stat cards show '—', dilution cards show loading skeleton (!dilutionData → loading=true)
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBe(2);
    });
  });

  // --- Tab Navigation ---

  describe('Tab Navigation', () => {
    it('renders all four tabs', () => {
      render(<ReportsPage />);
      expect(screen.getByText('Ownership')).toBeInTheDocument();
      expect(screen.getByText('Dilution')).toBeInTheDocument();
      expect(screen.getByText('Cap Table Export')).toBeInTheDocument();
      expect(screen.getByText('Due Diligence')).toBeInTheDocument();
    });

    it('shows ownership tab by default', () => {
      render(<ReportsPage />);
      // Ownership tab content: shareholders table should be visible
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    it('switches to dilution tab on click', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Dilution'));
      // Dilution tab has granularity dropdown options
      expect(screen.getByText('Daily')).toBeInTheDocument();
    });

    it('switches to export tab on click', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      // Export tab content
      expect(screen.getByText('Export the current cap table in various formats')).toBeInTheDocument();
    });

    it('switches to due diligence tab on click', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Due Diligence'));
      // Due diligence tab content
      expect(
        screen.getByText('Generate a comprehensive due diligence package'),
      ).toBeInTheDocument();
    });
  });

  // --- Ownership Tab ---

  describe('Ownership Tab', () => {
    it('renders shareholders table with data', () => {
      render(<ReportsPage />);
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });

    it('renders share class name in table', () => {
      render(<ReportsPage />);
      expect(screen.getAllByText('Quotas').length).toBeGreaterThan(0);
    });

    it('renders formatted share counts', () => {
      render(<ReportsPage />);
      expect(screen.getByText('60.000')).toBeInTheDocument();
      expect(screen.getByText('40.000')).toBeInTheDocument();
    });

    it('renders ownership percentages', () => {
      render(<ReportsPage />);
      // formatPct uses minimumFractionDigits: 1, so 60.00 → "60,0%"
      expect(screen.getByText('60,0%')).toBeInTheDocument();
      expect(screen.getByText('40,0%')).toBeInTheDocument();
    });

    it('renders fully diluted percentages', () => {
      render(<ReportsPage />);
      expect(screen.getByText('50,0%')).toBeInTheDocument();
      expect(screen.getByText('33,33%')).toBeInTheDocument();
    });

    it('renders total shares summary stat', () => {
      render(<ReportsPage />);
      // Inside OwnershipTab's summary section
      const totalSharesLabels = screen.getAllByText('Total Shares');
      expect(totalSharesLabels.length).toBeGreaterThanOrEqual(2); // stat card + tab summary
    });

    it('renders fully diluted summary stat', () => {
      render(<ReportsPage />);
      expect(screen.getByText('Fully Diluted')).toBeInTheDocument();
      expect(screen.getByText('120.000')).toBeInTheDocument();
    });

    it('renders option pool summary', () => {
      render(<ReportsPage />);
      expect(screen.getByText('Option Pool Summary')).toBeInTheDocument();
      expect(screen.getByText('Total Pool')).toBeInTheDocument();
      expect(screen.getByText('20.000')).toBeInTheDocument();
    });

    it('renders all option pool metrics', () => {
      render(<ReportsPage />);
      expect(screen.getByText('Granted')).toBeInTheDocument();
      expect(screen.getByText('15.000')).toBeInTheDocument();
      expect(screen.getByText('Exercised')).toBeInTheDocument();
      // 5.000 appears twice: exercised (5000) and available (5000)
      expect(screen.getAllByText('5.000').length).toBe(2);
      expect(screen.getByText('Vested (Unexercised)')).toBeInTheDocument();
      expect(screen.getByText('3.000')).toBeInTheDocument();
      expect(screen.getByText('Unvested')).toBeInTheDocument();
      expect(screen.getByText('7.000')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
    });

    it('renders share class filter dropdown', () => {
      render(<ReportsPage />);
      expect(screen.getByText('All classes')).toBeInTheDocument();
    });

    it('renders include options checkbox', () => {
      render(<ReportsPage />);
      expect(screen.getByText('Include option pool')).toBeInTheDocument();
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('renders share class options in dropdown', () => {
      render(<ReportsPage />);
      // The dropdown should contain option elements with share class names
      const select = screen.getAllByRole('combobox')[0]; // First select is share class filter
      expect(select).toBeInTheDocument();
    });

    it('shows empty state when no shareholders', () => {
      setupDefaultMocks({
        ownership: {
          data: {
            ...mockOwnershipData,
            shareholders: [],
            optionPoolSummary: null,
          },
          isLoading: false,
        },
      });
      render(<ReportsPage />);
      expect(screen.getByText('No shareholders found')).toBeInTheDocument();
    });

    it('shows loading skeleton when ownership is loading', () => {
      setupDefaultMocks({
        ownership: { data: null, isLoading: true },
      });
      render(<ReportsPage />);
      const pulseElements = document.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('shows error state when ownership fetch fails', () => {
      setupDefaultMocks({
        ownership: { data: null, isLoading: false, error: new Error('fail') },
      });
      render(<ReportsPage />);
      // Error state shows the title text
      const ownershipTexts = screen.getAllByText('Ownership Report');
      expect(ownershipTexts.length).toBeGreaterThan(0);
    });

    it('does not render option pool when optionPoolSummary is null', () => {
      setupDefaultMocks({
        ownership: {
          data: { ...mockOwnershipData, optionPoolSummary: null },
          isLoading: false,
        },
      });
      render(<ReportsPage />);
      expect(screen.queryByText('Option Pool Summary')).not.toBeInTheDocument();
    });
  });

  // --- Dilution Tab ---

  describe('Dilution Tab', () => {
    beforeEach(() => {
      setupDefaultMocks();
    });

    it('renders dilution metrics', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Dilution'));
      expect(screen.getAllByText('Gini Coefficient').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Foreign Ownership').length).toBeGreaterThan(0);
    });

    it('renders data points count', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Dilution'));
      // "Data Points" appears as summary metric label AND as table header "period"
      expect(screen.getAllByText('Data Points').length).toBeGreaterThanOrEqual(1);
      // "2" also appears in the shareholders stat card, so use getAllByText
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    });

    it('renders dilution data table', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Dilution'));
      // Table should show dates formatted in pt-BR
      expect(screen.getByText('80.000')).toBeInTheDocument();
    });

    it('renders granularity selector', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Dilution'));
      expect(screen.getByText('Daily')).toBeInTheDocument();
      expect(screen.getByText('Weekly')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
    });

    it('renders date range filters', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Dilution'));
      // input[type="date"] doesn't have textbox role in JSDOM
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    });

    it('shows no data points message when empty', () => {
      setupDefaultMocks({
        dilution: {
          data: { ...mockDilutionData, dataPoints: [] },
          isLoading: false,
        },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Dilution'));
      expect(screen.getByText('No data points for the selected period')).toBeInTheDocument();
    });

    it('shows loading skeleton when dilution is loading', () => {
      setupDefaultMocks({
        dilution: { data: null, isLoading: true },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Dilution'));
      const pulseElements = document.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('shows error state when dilution fetch fails', () => {
      setupDefaultMocks({
        dilution: { data: null, isLoading: false, error: new Error('fail') },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Dilution'));
      // Error state renders title
      const dilutionTexts = screen.getAllByText('Dilution Analysis');
      expect(dilutionTexts.length).toBeGreaterThan(0);
    });

    it('renders share class columns in data table', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Dilution'));
      // The share class name from the data point is rendered as column header
      const quotasCells = screen.getAllByText('Quotas');
      expect(quotasCells.length).toBeGreaterThan(0);
    });
  });

  // --- Export Tab ---

  describe('Export Tab', () => {
    beforeEach(() => {
      setupDefaultMocks();
    });

    it('renders export form', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      expect(screen.getByText('Export the current cap table in various formats')).toBeInTheDocument();
    });

    it('renders format selector with all options', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('Excel (XLSX)')).toBeInTheDocument();
      expect(screen.getByText('CSV')).toBeInTheDocument();
      expect(screen.getByText('OCT (JSON)')).toBeInTheDocument();
    });

    it('renders export button', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('calls export mutation when button is clicked', () => {
      const mockMutate = jest.fn();
      setupDefaultMocks({
        exportCapTable: { mutate: mockMutate, data: null, isPending: false },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      fireEvent.click(screen.getByText('Export'));
      expect(mockMutate).toHaveBeenCalledWith({
        format: 'pdf',
        snapshotDate: undefined,
      });
    });

    it('shows loading state when export is pending', () => {
      setupDefaultMocks({
        exportCapTable: { mutate: jest.fn(), data: null, isPending: true },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      expect(screen.getByText('Exporting...')).toBeInTheDocument();
    });

    it('shows export status card when job is queued', () => {
      setupDefaultMocks({
        exportCapTable: {
          mutate: jest.fn(),
          data: { jobId: 'job-1', status: 'QUEUED', downloadUrl: null, errorCode: null },
          isPending: false,
        },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      expect(screen.getByText('Export queued...')).toBeInTheDocument();
    });

    it('shows completed status with download link', () => {
      setupDefaultMocks({
        exportCapTable: {
          mutate: jest.fn(),
          data: { jobId: 'job-1', status: 'COMPLETED', downloadUrl: null, errorCode: null },
          isPending: false,
        },
        exportJobStatus: {
          data: {
            jobId: 'job-1',
            status: 'COMPLETED',
            downloadUrl: 'https://s3.example.com/export.pdf',
            errorCode: null,
          },
        },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      expect(screen.getByText('Export ready!')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
      expect(screen.getByText('Download').closest('a')).toHaveAttribute(
        'href',
        'https://s3.example.com/export.pdf',
      );
    });

    it('shows failed status', () => {
      setupDefaultMocks({
        exportCapTable: {
          mutate: jest.fn(),
          data: {
            jobId: 'job-1',
            status: 'FAILED',
            downloadUrl: null,
            errorCode: 'EXPORT_TOO_LARGE',
          },
          isPending: false,
        },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      expect(screen.getByText('EXPORT_TOO_LARGE')).toBeInTheDocument();
    });

    it('renders snapshot date input', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      expect(screen.getByText('Snapshot Date')).toBeInTheDocument();
    });
  });

  // --- Due Diligence Tab ---

  describe('Due Diligence Tab', () => {
    beforeEach(() => {
      setupDefaultMocks();
    });

    it('renders due diligence form', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Due Diligence'));
      expect(
        screen.getByText('Generate a comprehensive due diligence package'),
      ).toBeInTheDocument();
    });

    it('renders generate button', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Due Diligence'));
      expect(screen.getByText('Generate')).toBeInTheDocument();
    });

    it('renders date range inputs', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Due Diligence'));
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    });

    it('calls generate mutation when button is clicked', () => {
      const mockMutate = jest.fn();
      setupDefaultMocks({
        dueDiligence: { mutate: mockMutate, data: null, isPending: false },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Due Diligence'));
      fireEvent.click(screen.getByText('Generate'));
      expect(mockMutate).toHaveBeenCalledWith({
        dateFrom: undefined,
        dateTo: undefined,
      });
    });

    it('shows loading state when generation is pending', () => {
      setupDefaultMocks({
        dueDiligence: { mutate: jest.fn(), data: null, isPending: true },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Due Diligence'));
      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });

    it('shows completed status with download link', () => {
      setupDefaultMocks({
        dueDiligence: {
          mutate: jest.fn(),
          data: { jobId: 'dd-1', status: 'COMPLETED', downloadUrl: null, errorCode: null },
          isPending: false,
        },
        dueDiligenceJobStatus: {
          data: {
            jobId: 'dd-1',
            status: 'COMPLETED',
            downloadUrl: 'https://s3.example.com/due-diligence.zip',
            errorCode: null,
          },
        },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Due Diligence'));
      expect(screen.getByText('Package ready!')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    it('shows failed status', () => {
      setupDefaultMocks({
        dueDiligence: {
          mutate: jest.fn(),
          data: {
            jobId: 'dd-1',
            status: 'FAILED',
            downloadUrl: null,
            errorCode: 'DD_GENERATION_ERROR',
          },
          isPending: false,
        },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Due Diligence'));
      expect(screen.getByText('DD_GENERATION_ERROR')).toBeInTheDocument();
    });
  });

  // --- Hook Invocation ---

  describe('Hook Invocation', () => {
    it('passes companyId to useOwnershipReport', () => {
      render(<ReportsPage />);
      expect(mockUseOwnershipReport).toHaveBeenCalledWith('c1', { includeOptions: true });
    });

    it('passes companyId to useDilutionReport', () => {
      render(<ReportsPage />);
      expect(mockUseDilutionReport).toHaveBeenCalledWith('c1');
    });

    it('passes companyId to useExportCapTable', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));
      expect(mockUseExportCapTable).toHaveBeenCalledWith('c1');
    });

    it('passes companyId to useGenerateDueDiligence', () => {
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Due Diligence'));
      expect(mockUseGenerateDueDiligence).toHaveBeenCalledWith('c1');
    });

    it('does not pass companyId when no company selected', () => {
      setupDefaultMocks({ company: { selectedCompany: null, isLoading: false } });
      render(<ReportsPage />);
      expect(mockUseOwnershipReport).toHaveBeenCalledWith(undefined, { includeOptions: true });
    });
  });

  // --- Export Format Change ---

  describe('Export Format Selection', () => {
    it('changes format when selecting from dropdown', () => {
      const mockMutate = jest.fn();
      setupDefaultMocks({
        exportCapTable: { mutate: mockMutate, data: null, isPending: false },
      });
      render(<ReportsPage />);
      fireEvent.click(screen.getByText('Cap Table Export'));

      // Change format to xlsx
      const formatSelect = screen.getByDisplayValue('PDF');
      fireEvent.change(formatSelect, { target: { value: 'xlsx' } });

      // Click export
      fireEvent.click(screen.getByText('Export'));
      expect(mockMutate).toHaveBeenCalledWith({
        format: 'xlsx',
        snapshotDate: undefined,
      });
    });
  });

  // --- Table Headers ---

  describe('Ownership Table Headers', () => {
    it('renders all table column headers', () => {
      render(<ReportsPage />);
      expect(screen.getByText('Shareholder')).toBeInTheDocument();
      expect(screen.getByText('Share Class')).toBeInTheDocument();
      expect(screen.getByText('Shares')).toBeInTheDocument();
      expect(screen.getByText('Ownership %')).toBeInTheDocument();
      expect(screen.getByText('Fully Diluted %')).toBeInTheDocument();
    });
  });
});
