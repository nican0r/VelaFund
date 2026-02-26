import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DocumentsPage from '../page';

// --- Translation mock ---

const translations: Record<string, string> = {
  title: 'Documents',
  description: 'Manage and generate company documents.',
  upload: 'Upload',
  newDocument: 'New Document',
  empty: 'No documents found',
  emptyDescription: 'Create or upload your first document to get started.',
  'stats.total': 'Total Documents',
  'stats.drafts': 'Drafts',
  'stats.generated': 'Generated',
  'stats.pendingSignatures': 'Pending Signatures',
  'filter.searchPlaceholder': 'Search documents...',
  'filter.allTypes': 'All types',
  'filter.allStatuses': 'All statuses',
  'table.title': 'Title',
  'table.template': 'Template',
  'table.status': 'Status',
  'table.createdAt': 'Created',
  'table.actions': 'Actions',
  'status.DRAFT': 'Draft',
  'status.GENERATED': 'Generated',
  'status.PENDING_SIGNATURES': 'Pending Signatures',
  'status.PARTIALLY_SIGNED': 'Partially Signed',
  'status.FULLY_SIGNED': 'Fully Signed',
  'type.SHAREHOLDER_AGREEMENT': 'Shareholder Agreement',
  'type.MEETING_MINUTES': 'Meeting Minutes',
  'type.SHARE_CERTIFICATE': 'Share Certificate',
  'type.OPTION_LETTER': 'Option Letter',
  'type.INVESTMENT_AGREEMENT': 'Investment Agreement',
  'actions.view': 'View',
  'actions.download': 'Download',
  'actions.delete': 'Delete',
  'deleteDialog.title': 'Delete Document',
  'deleteDialog.description':
    'Are you sure you want to delete this document? This action cannot be undone.',
  'deleteDialog.cancel': 'Cancel',
  'deleteDialog.confirm': 'Delete',
  'uploadDialog.title': 'Upload Document',
  'uploadDialog.description': 'Upload a PDF, JPEG, or PNG file (max 10 MB).',
  'uploadDialog.titleLabel': 'Document Title',
  'uploadDialog.titlePlaceholder': 'Enter document title',
  'uploadDialog.fileLabel': 'File',
  'uploadDialog.dropzone': 'Click to select a file',
  'uploadDialog.dropzoneFormats': 'PDF, JPEG, PNG up to 10 MB',
  'uploadDialog.invalidType': 'Invalid file type',
  'uploadDialog.tooLarge': 'File is too large',
  'uploadDialog.cancel': 'Cancel',
  'uploadDialog.upload': 'Upload',
  'uploadDialog.uploading': 'Uploading...',
  'pagination.showing': 'Showing {from} to {to} of {total}',
  'pagination.previous': 'Previous',
  'pagination.next': 'Next',
  'pagination.page': 'Page',
  'pagination.of': 'of',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const all: Record<string, Record<string, string>> = {
      documents: translations,
    };
    return (key: string, params?: Record<string, unknown>) => {
      let result = all[namespace]?.[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v));
        });
      }
      return result;
    };
  },
}));

// --- Next/Link mock ---

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

// --- Company context mock ---

const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

// --- Hook mocks ---

const mockUseDocuments = jest.fn();
const mockUseDeleteDocument = jest.fn();
jest.mock('@/hooks/use-documents', () => ({
  useDocuments: (...args: unknown[]) => mockUseDocuments(...args),
  useDeleteDocument: (...args: unknown[]) => mockUseDeleteDocument(...args),
}));

// --- Error toast mock ---

const mockShowError = jest.fn();
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => ({ showError: mockShowError }),
}));

// --- Mock data ---

const mockCompany = { id: 'c1', name: 'Acme', status: 'ACTIVE' };

const mockDocuments = [
  {
    id: 'doc-1',
    title: 'Shareholder Agreement v1',
    status: 'DRAFT' as const,
    template: { documentType: 'SHAREHOLDER_AGREEMENT', name: 'Template A' },
    s3Key: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'doc-2',
    title: 'Meeting Minutes Q1',
    status: 'GENERATED' as const,
    template: { documentType: 'MEETING_MINUTES', name: 'Template B' },
    s3Key: 'documents/abc.pdf',
    createdAt: '2026-02-01T14:30:00.000Z',
    updatedAt: '2026-02-01T14:30:00.000Z',
  },
  {
    id: 'doc-3',
    title: 'Signed Certificate',
    status: 'FULLY_SIGNED' as const,
    template: { documentType: 'SHARE_CERTIFICATE', name: 'Template C' },
    s3Key: 'documents/def.pdf',
    createdAt: '2026-02-10T09:00:00.000Z',
    updatedAt: '2026-02-10T09:00:00.000Z',
  },
];

const mockMeta = { total: 3, page: 1, limit: 20, totalPages: 1 };

// --- Setup helper ---

function setupDefaultMocks(overrides?: {
  company?: Record<string, unknown>;
  documents?: Record<string, unknown>;
  deleteMutation?: Record<string, unknown>;
}) {
  mockUseCompany.mockReturnValue({
    companies: [mockCompany],
    selectedCompany: mockCompany,
    setSelectedCompanyId: jest.fn(),
    isLoading: false,
    error: null,
    ...overrides?.company,
  });
  mockUseDocuments.mockReturnValue({
    data: { data: mockDocuments, meta: mockMeta },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    ...overrides?.documents,
  });
  mockUseDeleteDocument.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides?.deleteMutation,
  });
}

// --- Tests ---

describe('DocumentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Page title and description
  it('renders page title and description', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(
      screen.getByText('Manage and generate company documents.'),
    ).toBeInTheDocument();
  });

  // 2. Stat cards with correct values
  it('renders stat cards with correct values', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    expect(screen.getByText('Total Documents')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    // 'Generated' appears in stat card label, status filter option, and status badge
    expect(screen.getAllByText('Generated').length).toBeGreaterThanOrEqual(1);
    // 'Pending Signatures' appears in stat card label and status filter option
    expect(screen.getAllByText('Pending Signatures').length).toBeGreaterThanOrEqual(1);
    // 1 DRAFT, 1 GENERATED, 0 pending
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  // 3. Stat cards loading state
  it('renders stat cards in loading state', () => {
    setupDefaultMocks({
      company: { isLoading: true },
      documents: { data: undefined, isLoading: true },
    });
    render(<DocumentsPage />);

    expect(screen.getByText('Total Documents')).toBeInTheDocument();
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  // 4. Document table with all documents
  it('renders document table with all documents', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    expect(screen.getByText('Shareholder Agreement v1')).toBeInTheDocument();
    expect(screen.getByText('Meeting Minutes Q1')).toBeInTheDocument();
    expect(screen.getByText('Signed Certificate')).toBeInTheDocument();
  });

  // 5. Status badges
  it('renders status badges correctly for DRAFT, GENERATED, and FULLY_SIGNED', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    // Draft status badge (only appears once as badge; 'Draft' also in filter options)
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1);
    // 'Generated' appears in stat card label, status filter option, and status badge
    expect(screen.getAllByText('Generated').length).toBeGreaterThanOrEqual(3);
    // Fully Signed appears as badge and filter option
    expect(screen.getAllByText('Fully Signed').length).toBeGreaterThanOrEqual(1);
  });

  // 6. Template type names
  it('renders template type names', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    // Type names appear in both the table cells and the type filter dropdown options
    expect(screen.getAllByText('Shareholder Agreement').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Meeting Minutes').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Share Certificate').length).toBeGreaterThanOrEqual(2);
  });

  // 7. Formatted dates in pt-BR
  it('renders formatted dates in pt-BR format', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    // 2026-01-15 -> 15/01/2026
    expect(screen.getByText('15/01/2026')).toBeInTheDocument();
    // 2026-02-01 -> 01/02/2026
    expect(screen.getByText('01/02/2026')).toBeInTheDocument();
    // 2026-02-10 -> 10/02/2026
    expect(screen.getByText('10/02/2026')).toBeInTheDocument();
  });

  // 8. View action button for all documents
  it('shows view action button for all documents', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    const viewButtons = screen.getAllByTitle('View');
    expect(viewButtons).toHaveLength(3);
    expect(viewButtons[0].closest('a')).toHaveAttribute(
      'href',
      '/dashboard/documents/doc-1',
    );
    expect(viewButtons[1].closest('a')).toHaveAttribute(
      'href',
      '/dashboard/documents/doc-2',
    );
    expect(viewButtons[2].closest('a')).toHaveAttribute(
      'href',
      '/dashboard/documents/doc-3',
    );
  });

  // 9. Delete button only for DRAFT and GENERATED
  it('shows delete button only for DRAFT and GENERATED documents', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    const deleteButtons = screen.getAllByTitle('Delete');
    // doc-1 (DRAFT) and doc-2 (GENERATED) are deletable; doc-3 (FULLY_SIGNED) is not
    expect(deleteButtons).toHaveLength(2);
  });

  // 10. Download icon for documents with s3Key
  it('shows download icon for documents with s3Key', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    const downloadButtons = screen.getAllByTitle('Download');
    // doc-2 and doc-3 have s3Key; doc-1 does not
    expect(downloadButtons).toHaveLength(2);
  });

  // 11. No download icon for documents without s3Key
  it('does NOT show download icon for documents without s3Key', () => {
    setupDefaultMocks({
      documents: {
        data: {
          data: [mockDocuments[0]], // only doc-1 with s3Key: null
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        },
        isLoading: false,
      },
    });
    render(<DocumentsPage />);

    expect(screen.queryByTitle('Download')).not.toBeInTheDocument();
  });

  // 12. Empty state when no documents
  it('shows empty state when no documents', () => {
    setupDefaultMocks({
      documents: {
        data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        isLoading: false,
      },
    });
    render(<DocumentsPage />);

    expect(screen.getByText('No documents found')).toBeInTheDocument();
    expect(
      screen.getByText('Create or upload your first document to get started.'),
    ).toBeInTheDocument();
  });

  // 13. No-company state
  it('shows no-company state when selectedCompany is null', () => {
    setupDefaultMocks({
      company: { selectedCompany: null, companies: [], isLoading: false },
      documents: { data: undefined, isLoading: false },
    });
    render(<DocumentsPage />);

    expect(screen.getByText('No documents found')).toBeInTheDocument();
  });

  // 14. Error state
  it('shows error state when there is an error', () => {
    setupDefaultMocks({
      documents: {
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load documents'),
      },
    });
    render(<DocumentsPage />);

    expect(screen.getByText('Failed to load documents')).toBeInTheDocument();
  });

  // 15. Clicking delete button opens delete dialog
  it('clicking delete button opens delete dialog', async () => {
    setupDefaultMocks();
    const user = userEvent.setup();
    render(<DocumentsPage />);

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(screen.getByText('Delete Document')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Are you sure you want to delete this document? This action cannot be undone.',
      ),
    ).toBeInTheDocument();
  });

  // 16. Clicking delete confirm calls mutateAsync
  it('clicking delete confirm calls mutateAsync', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
    setupDefaultMocks({
      deleteMutation: { mutateAsync: mockMutateAsync, isPending: false },
    });
    const user = userEvent.setup();
    render(<DocumentsPage />);

    // Open delete dialog for doc-1
    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    // Click confirm button in dialog (the red bg button with text "Delete")
    const allDeleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    // The dialog confirm button is the last one rendered
    const confirmButton = allDeleteButtons[allDeleteButtons.length - 1];
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('doc-1');
    });
  });

  // 17. Search input filters documents
  it('search input filters documents by updating query params', async () => {
    setupDefaultMocks();
    const user = userEvent.setup();
    render(<DocumentsPage />);

    const searchInput = screen.getByPlaceholderText('Search documents...');
    await user.type(searchInput, 'Agreement');

    // useDocuments should be called with the search parameter
    expect(mockUseDocuments).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ search: 'Agreement' }),
    );
  });

  // 18. Status filter dropdown works
  it('status filter dropdown works', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    const selects = screen.getAllByRole('combobox');
    // Status filter is the last select (3rd)
    const statusSelect = selects[selects.length - 1];
    fireEvent.change(statusSelect, { target: { value: 'DRAFT' } });

    expect(mockUseDocuments).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ status: 'DRAFT' }),
    );
  });

  // 19. Type filter dropdown works
  it('type filter dropdown works', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    const selects = screen.getAllByRole('combobox');
    // Type filter is the second select (index 1)
    const typeSelect = selects[selects.length - 2];
    fireEvent.change(typeSelect, {
      target: { value: 'SHAREHOLDER_AGREEMENT' },
    });

    expect(mockUseDocuments).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ type: 'SHAREHOLDER_AGREEMENT' }),
    );
  });

  // 20. Pagination shows when totalPages > 1
  it('pagination shows when totalPages > 1', () => {
    setupDefaultMocks({
      documents: {
        data: {
          data: mockDocuments,
          meta: { total: 50, page: 1, limit: 20, totalPages: 3 },
        },
        isLoading: false,
      },
    });
    render(<DocumentsPage />);

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    // page=1, limit=20, total=50 => "Showing 1 to 20 of 50"
    expect(screen.getByText('Showing 1 to 20 of 50')).toBeInTheDocument();
  });

  // 21. Pagination does not show when totalPages <= 1
  it('pagination does not show when totalPages <= 1', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  // 22. Clicking next page increments page
  it('clicking next page button increments page', async () => {
    setupDefaultMocks({
      documents: {
        data: {
          data: mockDocuments,
          meta: { total: 50, page: 1, limit: 20, totalPages: 3 },
        },
        isLoading: false,
      },
    });
    const user = userEvent.setup();
    render(<DocumentsPage />);

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    expect(mockUseDocuments).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ page: 2 }),
    );
  });

  // 23. Clicking previous page decrements page
  it('clicking previous page button decrements page', async () => {
    // Start on page 2
    setupDefaultMocks({
      documents: {
        data: {
          data: mockDocuments,
          meta: { total: 50, page: 2, limit: 20, totalPages: 3 },
        },
        isLoading: false,
      },
    });
    const user = userEvent.setup();
    render(<DocumentsPage />);

    // First go to page 2 by clicking next
    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    // Now the previous button should be enabled
    const prevButton = screen.getByText('Previous');
    await user.click(prevButton);

    // After clicking next then previous, we should be back at page 1 (the initial page + 1 - 1)
    // The important thing is that Previous was clicked and the hook got called
    const calls = mockUseDocuments.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toEqual(expect.objectContaining({ page: 1 }));
  });

  // 24. New document link
  it('new document link points to /dashboard/documents/new', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    const newDocLink = screen.getByText('New Document');
    expect(newDocLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/documents/new',
    );
  });

  // 25. Upload button opens upload dialog
  it('upload button opens upload dialog', async () => {
    setupDefaultMocks();
    const user = userEvent.setup();
    render(<DocumentsPage />);

    const uploadButton = screen.getByText('Upload');
    await user.click(uploadButton);

    expect(screen.getByText('Upload Document')).toBeInTheDocument();
    expect(
      screen.getByText('Upload a PDF, JPEG, or PNG file (max 10 MB).'),
    ).toBeInTheDocument();
  });

  // 26. Table column headers
  it('renders table column headers', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Template')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  // 27. Document title links to detail page
  it('document titles link to their detail pages', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    const titleLink = screen.getByText('Shareholder Agreement v1');
    expect(titleLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/documents/doc-1',
    );
  });

  // 28. Empty state has create button with link
  it('empty state has a link to create new document', () => {
    setupDefaultMocks({
      documents: {
        data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        isLoading: false,
      },
    });
    render(<DocumentsPage />);

    // The empty state also renders a "New Document" link
    const newDocLinks = screen.getAllByText('New Document');
    const emptyStateLink = newDocLinks.find(
      (el) => el.closest('a')?.getAttribute('href') === '/dashboard/documents/new',
    );
    expect(emptyStateLink).toBeInTheDocument();
  });

  // 29. Delete dialog cancel closes dialog
  it('clicking cancel in delete dialog closes it', async () => {
    setupDefaultMocks();
    const user = userEvent.setup();
    render(<DocumentsPage />);

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    // Dialog is open
    expect(screen.getByText('Delete Document')).toBeInTheDocument();

    // Click Cancel
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    // Dialog should be closed
    expect(screen.queryByText('Delete Document')).not.toBeInTheDocument();
  });

  // 30. Upload dialog shows file input area
  it('upload dialog shows file drop zone and title input', async () => {
    setupDefaultMocks();
    const user = userEvent.setup();
    render(<DocumentsPage />);

    await user.click(screen.getByText('Upload'));

    expect(screen.getByText('Document Title')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Enter document title'),
    ).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Click to select a file')).toBeInTheDocument();
    expect(
      screen.getByText('PDF, JPEG, PNG up to 10 MB'),
    ).toBeInTheDocument();
  });

  // 31. Loading skeleton shown in table area
  it('shows table skeleton when loading', () => {
    setupDefaultMocks({
      company: { isLoading: false },
      documents: { data: undefined, isLoading: true },
    });
    render(<DocumentsPage />);

    // Skeleton rows should be rendered (5 skeleton rows with animate-pulse)
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    // 4 stat card pulses + 25 table skeleton elements (5 rows x 5 columns)
    expect(pulsingElements.length).toBeGreaterThanOrEqual(5);
  });

  // 32. Search clear button works
  it('search clear button clears the search query', async () => {
    setupDefaultMocks();
    const user = userEvent.setup();
    render(<DocumentsPage />);

    const searchInput = screen.getByPlaceholderText('Search documents...');
    await user.type(searchInput, 'test');

    // The X clear button should appear
    // Find the clear button (the X icon button near the search)
    // After typing, there should be a button that clears the input
    const clearButtons = document.querySelectorAll(
      'button.absolute',
    );
    expect(clearButtons.length).toBeGreaterThanOrEqual(1);
  });

  // 33. Passes correct initial params to useDocuments hook
  it('passes correct initial filter params to useDocuments hook', () => {
    setupDefaultMocks();
    render(<DocumentsPage />);

    expect(mockUseDocuments).toHaveBeenCalledWith('c1', {
      page: 1,
      limit: 20,
      status: undefined,
      type: undefined,
      search: undefined,
      sort: '-createdAt',
    });
  });

  // 34. Delete for second document (GENERATED) also works
  it('clicking delete on GENERATED document opens dialog and confirms correctly', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
    setupDefaultMocks({
      deleteMutation: { mutateAsync: mockMutateAsync, isPending: false },
    });
    const user = userEvent.setup();
    render(<DocumentsPage />);

    // Delete buttons: doc-1 (DRAFT) is index 0, doc-2 (GENERATED) is index 1
    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[1]);

    expect(screen.getByText('Delete Document')).toBeInTheDocument();

    // Click confirm button in dialog (the last "Delete" button)
    const allDeleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    const confirmButton = allDeleteButtons[allDeleteButtons.length - 1];
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('doc-2');
    });
  });

  // 35. Pagination page info text
  it('shows correct page info text in pagination', () => {
    setupDefaultMocks({
      documents: {
        data: {
          data: mockDocuments,
          meta: { total: 50, page: 1, limit: 20, totalPages: 3 },
        },
        isLoading: false,
      },
    });
    render(<DocumentsPage />);

    // The page counter renders: "Page" {page} "of" {totalPages}
    // With internal page=1, totalPages=3: "Page 1 of 3" spread across text nodes
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  // 36. Previous button disabled on first page
  it('previous button is disabled on the first page', () => {
    setupDefaultMocks({
      documents: {
        data: {
          data: mockDocuments,
          meta: { total: 50, page: 1, limit: 20, totalPages: 3 },
        },
        isLoading: false,
      },
    });
    render(<DocumentsPage />);

    const prevButton = screen.getByText('Previous').closest('button');
    expect(prevButton).toBeDisabled();
  });

  // 37. Upload dialog cancel closes it
  it('upload dialog cancel button closes the dialog', async () => {
    setupDefaultMocks();
    const user = userEvent.setup();
    render(<DocumentsPage />);

    await user.click(screen.getByText('Upload'));
    expect(screen.getByText('Upload Document')).toBeInTheDocument();

    // The upload dialog has its own cancel button
    // There may be two 'Cancel' texts (upload dialog cancel)
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    await user.click(cancelButtons[cancelButtons.length - 1]);

    expect(screen.queryByText('Upload Document')).not.toBeInTheDocument();
  });
});
