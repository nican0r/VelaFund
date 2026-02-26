import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DataroomPage from './page';

// --- i18n keys ---

const i18nKeys: Record<string, string> = {
  'dataroom.title': 'Dataroom',
  'dataroom.subtitle': 'Manage your documents.',
  'dataroom.upload.button': 'Upload Document',
  'dataroom.upload.title': 'Upload Document',
  'dataroom.upload.dragDrop': 'Drag and drop your file here',
  'dataroom.upload.formats': 'PDF, PNG, JPG, XLSX, PPTX, DOCX up to 25 MB',
  'dataroom.upload.category': 'Category',
  'dataroom.upload.categoryPlaceholder': 'Select a category',
  'dataroom.upload.name': 'Display name',
  'dataroom.upload.namePlaceholder': 'Optional display name',
  'dataroom.upload.uploading': 'Uploading...',
  'dataroom.upload.success': 'Document uploaded successfully.',
  'dataroom.upload.error': 'Failed to upload.',
  'dataroom.category.all': 'All',
  'dataroom.category.pitchDeck': 'Pitch Deck',
  'dataroom.category.financials': 'Financial',
  'dataroom.category.legal': 'Legal',
  'dataroom.category.product': 'Product',
  'dataroom.category.team': 'Team',
  'dataroom.category.other': 'Other',
  'dataroom.empty.title': 'No documents yet',
  'dataroom.empty.description': 'Upload your first document.',
  'dataroom.empty.filtered': 'No documents in this category.',
  'dataroom.delete.title': 'Delete Document',
  'dataroom.delete.success': 'Document deleted.',
  'dataroom.delete.error': 'Failed to delete.',
  'dataroom.document.download': 'Download',
  'dataroom.document.delete': 'Delete',
  'dataroom.storage.limit': 'Storage limit reached.',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    return (key: string, params?: Record<string, unknown>) => {
      const fullKey = `${namespace}.${key}`;

      if (fullKey === 'dataroom.storage.label') {
        return `${params?.used} of ${params?.max} used`;
      }
      if (fullKey === 'dataroom.document.pages') {
        return `${params?.count} pages`;
      }
      if (fullKey === 'dataroom.document.uploaded') {
        return `Uploaded ${params?.date}`;
      }
      if (fullKey === 'dataroom.upload.fileSelected') {
        return `File selected: ${params?.name}`;
      }
      if (fullKey === 'dataroom.delete.confirm') {
        return `Delete "${params?.name}"?`;
      }

      return i18nKeys[fullKey] ?? key;
    };
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// --- Mocks for hooks ---

const mockCompany = {
  id: 'c1',
  name: 'Acme',
  entityType: 'LTDA' as const,
  cnpj: '12.345.678/0001-90',
  status: 'ACTIVE' as const,
  logoUrl: null,
  role: 'ADMIN',
  memberCount: 3,
  createdAt: '2026-01-01',
};

let mockCompanyData = {
  selectedCompany: mockCompany as typeof mockCompany | null,
  companies: [mockCompany],
  isLoading: false,
  error: null,
  setSelectedCompanyId: jest.fn(),
};

jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockCompanyData,
}));

// Document hooks
let mockDocumentsData: {
  data: { documents: unknown[]; totalStorage: number; maxStorage: number } | undefined;
  isLoading: boolean;
  error: unknown;
} = {
  data: undefined,
  isLoading: false,
  error: null,
};

const mockUploadMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const mockDownloadMutate = jest.fn();

jest.mock('@/hooks/use-documents', () => ({
  useDocuments: () => mockDocumentsData,
  useUploadDocument: () => ({
    mutateAsync: mockUploadMutate,
    isPending: false,
  }),
  useDeleteDocument: () => ({
    mutateAsync: mockDeleteMutate,
    isPending: false,
  }),
  useReorderDocuments: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useDocumentDownload: () => ({
    mutateAsync: mockDownloadMutate,
    isPending: false,
  }),
}));

jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// --- Test data ---

const mockDocument = {
  id: 'doc1',
  profileId: 'p1',
  name: 'Q1 Financials.pdf',
  category: 'FINANCIALS' as const,
  fileKey: 'profiles/p1/documents/doc1.pdf',
  fileSize: 2048576,
  mimeType: 'application/pdf',
  pageCount: 15,
  thumbnailKey: null,
  order: 0,
  uploadedById: 'u1',
  uploadedAt: '2026-02-01T10:00:00Z',
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-01T10:00:00Z',
};

const mockDocument2 = {
  ...mockDocument,
  id: 'doc2',
  name: 'Pitch Deck 2026.pdf',
  category: 'PITCH_DECK' as const,
  fileSize: 5120000,
  pageCount: 25,
};

// --- Helper ---

function setupMocks(overrides?: {
  documents?: unknown[];
  totalStorage?: number;
  maxStorage?: number;
  isLoading?: boolean;
  noCompany?: boolean;
  companyLoading?: boolean;
}) {
  mockCompanyData = {
    selectedCompany: overrides?.noCompany ? null : mockCompany,
    companies: overrides?.noCompany ? [] : [mockCompany],
    isLoading: overrides?.companyLoading ?? false,
    error: null,
    setSelectedCompanyId: jest.fn(),
  };

  mockDocumentsData = {
    data: overrides?.isLoading
      ? undefined
      : {
          documents: overrides?.documents ?? [],
          totalStorage: overrides?.totalStorage ?? 0,
          maxStorage: overrides?.maxStorage ?? 524288000,
        },
    isLoading: overrides?.isLoading ?? false,
    error: null,
  };
}

// --- Tests ---

describe('DataroomPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  // --- Rendering ---

  it('renders the page title and subtitle', () => {
    render(<DataroomPage />);
    expect(screen.getByText('Dataroom')).toBeInTheDocument();
    expect(screen.getByText('Manage your documents.')).toBeInTheDocument();
  });

  it('renders the upload button in header', () => {
    render(<DataroomPage />);
    const buttons = screen.getAllByRole('button', { name: /Upload Document/i });
    // At least the header button exists (empty state also has one)
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders category filter tabs', () => {
    render(<DataroomPage />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Pitch Deck')).toBeInTheDocument();
    expect(screen.getByText('Financial')).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  // --- No company state ---

  it('renders no-company state when no company selected', () => {
    setupMocks({ noCompany: true });
    render(<DataroomPage />);
    expect(screen.getByText('No company found')).toBeInTheDocument();
  });

  // --- Loading state ---

  it('renders skeleton loading state', () => {
    setupMocks({ isLoading: true });
    render(<DataroomPage />);
    // Should show skeleton items (animate-pulse divs)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // --- Empty state ---

  it('renders empty state when no documents', () => {
    setupMocks({ documents: [] });
    render(<DataroomPage />);
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(screen.getByText('Upload your first document.')).toBeInTheDocument();
  });

  it('renders filtered empty state', async () => {
    setupMocks({ documents: [] });
    const user = userEvent.setup();
    render(<DataroomPage />);

    // Click on a category tab
    await user.click(screen.getByText('Financial'));
    expect(screen.getByText('No documents in this category.')).toBeInTheDocument();
  });

  // --- Document list ---

  it('renders documents when data is available', () => {
    setupMocks({ documents: [mockDocument, mockDocument2] });
    render(<DataroomPage />);
    expect(screen.getByText('Q1 Financials.pdf')).toBeInTheDocument();
    expect(screen.getByText('Pitch Deck 2026.pdf')).toBeInTheDocument();
  });

  it('shows file size for each document', () => {
    setupMocks({ documents: [mockDocument] });
    render(<DataroomPage />);
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('shows page count for PDF documents', () => {
    setupMocks({ documents: [mockDocument] });
    render(<DataroomPage />);
    expect(screen.getByText('15 pages')).toBeInTheDocument();
  });

  it('shows category badge for each document', () => {
    setupMocks({ documents: [mockDocument] });
    render(<DataroomPage />);
    // "Financial" appears twice: once in category tabs, once as badge on the document
    const financialElements = screen.getAllByText('Financial');
    expect(financialElements.length).toBe(2);
  });

  it('renders download and delete buttons for each document', () => {
    setupMocks({ documents: [mockDocument] });
    render(<DataroomPage />);
    const downloadBtn = screen.getByTitle('Download');
    const deleteBtn = screen.getByTitle('Delete');
    expect(downloadBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();
  });

  // --- Storage bar ---

  it('renders storage bar with usage info', () => {
    setupMocks({
      documents: [mockDocument],
      totalStorage: 52428800,
      maxStorage: 524288000,
    });
    render(<DataroomPage />);
    expect(screen.getByText('50.0 MB of 500.0 MB used')).toBeInTheDocument();
  });

  it('shows warning when storage is near limit', () => {
    setupMocks({
      documents: [mockDocument],
      totalStorage: 500000000,
      maxStorage: 524288000,
    });
    render(<DataroomPage />);
    expect(screen.getByText('Storage limit reached.')).toBeInTheDocument();
  });

  // --- Category filtering ---

  it('highlights active category tab', async () => {
    setupMocks({ documents: [] });
    const user = userEvent.setup();
    render(<DataroomPage />);

    const allTab = screen.getByText('All');
    // All tab should be highlighted by default
    expect(allTab).toHaveClass('bg-ocean-600');

    // Click Financial tab
    await user.click(screen.getByText('Financial'));
    expect(screen.getByText('Financial')).toHaveClass('bg-ocean-600');
  });

  // --- Download ---

  it('triggers download when download button is clicked', async () => {
    setupMocks({ documents: [mockDocument] });
    mockDownloadMutate.mockResolvedValueOnce({
      downloadUrl: 'https://s3.example.com/presigned',
      expiresIn: 900,
    });

    const windowOpen = jest.spyOn(window, 'open').mockImplementation();
    const user = userEvent.setup();
    render(<DataroomPage />);

    await user.click(screen.getByTitle('Download'));
    expect(mockDownloadMutate).toHaveBeenCalledWith('doc1');

    windowOpen.mockRestore();
  });

  // --- Delete ---

  it('opens delete confirmation dialog', async () => {
    setupMocks({ documents: [mockDocument] });
    const user = userEvent.setup();
    render(<DataroomPage />);

    await user.click(screen.getByTitle('Delete'));
    expect(screen.getByText('Delete Document')).toBeInTheDocument();
    expect(
      screen.getByText('Delete "Q1 Financials.pdf"?'),
    ).toBeInTheDocument();
  });

  it('calls delete mutation on confirm', async () => {
    setupMocks({ documents: [mockDocument] });
    mockDeleteMutate.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<DataroomPage />);

    // Open delete dialog
    await user.click(screen.getByTitle('Delete'));

    // Confirm deletion
    const dialog = screen.getByRole('dialog');
    const deleteButton = within(dialog).getByRole('button', {
      name: /Delete/i,
    });
    await user.click(deleteButton);

    expect(mockDeleteMutate).toHaveBeenCalledWith('doc1');
  });

  // --- Upload dialog ---

  it('opens upload dialog when header button clicked', async () => {
    setupMocks({ documents: [mockDocument] }); // Non-empty so only header button exists
    const user = userEvent.setup();
    render(<DataroomPage />);

    await user.click(
      screen.getByRole('button', { name: /Upload Document/i }),
    );
    expect(screen.getByText('Drag and drop your file here')).toBeInTheDocument();
  });

  // --- Multiple documents ---

  it('renders multiple documents in the list', () => {
    setupMocks({ documents: [mockDocument, mockDocument2] });
    render(<DataroomPage />);
    expect(screen.getByText('Q1 Financials.pdf')).toBeInTheDocument();
    expect(screen.getByText('Pitch Deck 2026.pdf')).toBeInTheDocument();
  });

  // --- Company loading ---

  it('shows loading state when company is loading', () => {
    setupMocks({ companyLoading: true, isLoading: true });
    render(<DataroomPage />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
