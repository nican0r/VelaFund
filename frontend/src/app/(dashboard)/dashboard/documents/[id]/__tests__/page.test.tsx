import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentDetailPage from '../page';

// --- Translation mocks ---

const translations: Record<string, string> = {
  'empty': 'No documents found',
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
  'detail.title': 'Document Details',
  'detail.back': 'Back to Documents',
  'detail.metadata': 'Metadata',
  'detail.template': 'Template',
  'detail.status': 'Status',
  'detail.locale': 'Language',
  'detail.createdAt': 'Created',
  'detail.updatedAt': 'Updated',
  'detail.generatedAt': 'Generated',
  'detail.contentHash': 'Content Hash',
  'detail.blockchainTxHash': 'Blockchain Hash',
  'detail.download': 'Download PDF',
  'detail.downloading': 'Downloading...',
  'detail.preview': 'Preview',
  'detail.previewTitle': 'Document Preview',
  'detail.editDraft': 'Edit Draft',
  'detail.generateFromDraft': 'Generate PDF',
  'detail.generating': 'Generating...',
  'detail.delete': 'Delete',
  'detail.noPreview': 'Preview not available for this document.',
  'detail.notFound': 'Document not found.',
  'detail.notFoundDescription': 'The document you are looking for does not exist.',
  'detail.error': 'An error occurred loading this document.',
  'detail.formData': 'Form Data',
  'detail.noFormData': 'No form data.',
  'detail.deleteSuccess': 'Document deleted successfully.',
  'detail.generateSuccess': 'Document generated successfully.',
  'detail.downloadError': 'Failed to get download link.',
  'deleteDialog.title': 'Delete Document',
  'deleteDialog.description': 'Are you sure you want to delete this document?',
  'deleteDialog.confirm': 'Delete',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const all: Record<string, Record<string, string>> = { documents: translations };
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

const mockRouterPush = jest.fn();
const mockParams = { id: 'doc-123' };
jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockRouterPush }),
}));

const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

const mockUseDocument = jest.fn();
const mockUseDocumentPreview = jest.fn();
const mockUseDocumentDownloadUrl = jest.fn();
const mockUseGenerateFromDraft = jest.fn();
const mockUseDeleteDocument = jest.fn();

jest.mock('@/hooks/use-documents', () => ({
  useDocument: (...args: unknown[]) => mockUseDocument(...args),
  useDocumentPreview: (...args: unknown[]) => mockUseDocumentPreview(...args),
  useDocumentDownloadUrl: (...args: unknown[]) => mockUseDocumentDownloadUrl(...args),
  useGenerateFromDraft: (...args: unknown[]) => mockUseGenerateFromDraft(...args),
  useDeleteDocument: (...args: unknown[]) => mockUseDeleteDocument(...args),
}));

const mockShowError = jest.fn();
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => ({ showError: mockShowError }),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// --- Mock data ---

const mockCompany = { id: 'c1', name: 'Acme', status: 'ACTIVE' };

const mockDraftDoc = {
  id: 'doc-123',
  companyId: 'c1',
  templateId: 'tpl-1',
  title: 'Draft Agreement',
  status: 'DRAFT' as const,
  formData: { partyName: 'John', amount: '1000' },
  s3Key: null,
  contentHash: null,
  blockchainTxHash: null,
  locale: 'pt-BR',
  generatedAt: null,
  anchoredAt: null,
  createdBy: 'u1',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-16T12:00:00.000Z',
  template: {
    id: 'tpl-1',
    documentType: 'SHAREHOLDER_AGREEMENT',
    name: 'SHA Template',
  },
};

const mockGeneratedDoc = {
  id: 'doc-456',
  companyId: 'c1',
  templateId: 'tpl-2',
  title: 'Generated Minutes',
  status: 'GENERATED' as const,
  formData: { date: '2026-02-01' },
  s3Key: 'documents/minutes.pdf',
  contentHash: 'abc123def456789012345678',
  blockchainTxHash: null,
  locale: 'en',
  generatedAt: '2026-02-01T15:00:00.000Z',
  anchoredAt: null,
  createdBy: 'u1',
  createdAt: '2026-02-01T10:00:00.000Z',
  updatedAt: '2026-02-01T15:00:00.000Z',
  template: {
    id: 'tpl-2',
    documentType: 'MEETING_MINUTES',
    name: 'Minutes Template',
  },
};

// --- Helpers ---

const mockMutationIdle = {
  mutateAsync: jest.fn(),
  isPending: false,
};

function setupDefaultMocks(overrides?: {
  doc?: typeof mockDraftDoc | typeof mockGeneratedDoc | null;
  isLoading?: boolean;
  error?: Error | null;
  previewHtml?: string | null;
  previewLoading?: boolean;
  companyLoading?: boolean;
  company?: typeof mockCompany | null;
}) {
  const {
    doc = mockDraftDoc,
    isLoading = false,
    error = null,
    previewHtml = null,
    previewLoading = false,
    companyLoading = false,
    company = mockCompany,
  } = overrides ?? {};

  mockUseCompany.mockReturnValue({
    selectedCompany: company,
    isLoading: companyLoading,
  });

  mockUseDocument.mockReturnValue({
    data: doc,
    isLoading,
    error,
  });

  mockUseDocumentPreview.mockReturnValue({
    data: previewHtml,
    isLoading: previewLoading,
  });

  mockUseDocumentDownloadUrl.mockReturnValue({
    refetch: jest.fn().mockResolvedValue({ data: { url: 'https://s3.example.com/file.pdf' } }),
  });

  mockUseGenerateFromDraft.mockReturnValue({ ...mockMutationIdle, mutateAsync: jest.fn().mockResolvedValue({}) });
  mockUseDeleteDocument.mockReturnValue({ ...mockMutationIdle, mutateAsync: jest.fn().mockResolvedValue({}) });
}

// --- Tests ---

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaultMocks();
});

describe('DocumentDetailPage', () => {
  // ─── Rendering ───────────────────────────────────────────────────────

  it('renders document title', () => {
    render(<DocumentDetailPage />);
    expect(screen.getByText('Draft Agreement')).toBeInTheDocument();
  });

  it('renders back link to /dashboard/documents', () => {
    render(<DocumentDetailPage />);
    const backLink = screen.getByText('Back to Documents');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/documents');
  });

  it('renders status badge for draft document', () => {
    render(<DocumentDetailPage />);
    // Status badge appears in the header and in the metadata card
    const badges = screen.getAllByText('Draft');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badge for generated document', () => {
    setupDefaultMocks({ doc: mockGeneratedDoc });
    render(<DocumentDetailPage />);
    const badges = screen.getAllByText('Generated');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders template name and type as subtitle', () => {
    render(<DocumentDetailPage />);
    // The subtitle pattern is: "Shareholder Agreement — SHA Template"
    // Template name also appears in the metadata card, so use getAllByText
    expect(screen.getByText(/Shareholder Agreement/)).toBeInTheDocument();
    const templateNames = screen.getAllByText(/SHA Template/);
    expect(templateNames.length).toBeGreaterThanOrEqual(1);
  });

  it('renders template type for generated document', () => {
    setupDefaultMocks({ doc: mockGeneratedDoc });
    render(<DocumentDetailPage />);
    expect(screen.getByText(/Meeting Minutes/)).toBeInTheDocument();
    const templateNames = screen.getAllByText(/Minutes Template/);
    expect(templateNames.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Action buttons: conditional visibility ───────────────────────────

  it('shows Edit Draft button only for DRAFT status', () => {
    render(<DocumentDetailPage />);
    expect(screen.getByText('Edit Draft')).toBeInTheDocument();

    // Verify it's a link to edit page
    const editLink = screen.getByText('Edit Draft').closest('a');
    expect(editLink).toHaveAttribute('href', '/dashboard/documents/doc-123/edit');
  });

  it('does not show Edit Draft button for non-DRAFT status', () => {
    setupDefaultMocks({ doc: mockGeneratedDoc });
    render(<DocumentDetailPage />);
    expect(screen.queryByText('Edit Draft')).not.toBeInTheDocument();
  });

  it('shows Generate PDF button only for DRAFT status', () => {
    render(<DocumentDetailPage />);
    // There are two Generate PDF buttons: one in the header, one in the preview area
    const generateButtons = screen.getAllByText('Generate PDF');
    expect(generateButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show Generate PDF button for non-DRAFT status', () => {
    setupDefaultMocks({ doc: mockGeneratedDoc });
    render(<DocumentDetailPage />);
    expect(screen.queryByText('Generate PDF')).not.toBeInTheDocument();
  });

  it('shows Download PDF button only for non-DRAFT with s3Key', () => {
    setupDefaultMocks({ doc: mockGeneratedDoc });
    render(<DocumentDetailPage />);
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
  });

  it('does not show Download PDF button for DRAFT status', () => {
    render(<DocumentDetailPage />);
    expect(screen.queryByText('Download PDF')).not.toBeInTheDocument();
  });

  it('does not show Download PDF button for non-DRAFT without s3Key', () => {
    const docWithoutS3Key = { ...mockGeneratedDoc, s3Key: null };
    setupDefaultMocks({ doc: docWithoutS3Key });
    render(<DocumentDetailPage />);
    expect(screen.queryByText('Download PDF')).not.toBeInTheDocument();
  });

  it('shows Delete button for all documents', () => {
    render(<DocumentDetailPage />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('shows Delete button for generated documents', () => {
    setupDefaultMocks({ doc: mockGeneratedDoc });
    render(<DocumentDetailPage />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  // ─── Metadata card ───────────────────────────────────────────────────

  it('renders metadata card with status, template, locale, dates', () => {
    render(<DocumentDetailPage />);
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Template')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });

  it('renders template name in metadata card', () => {
    render(<DocumentDetailPage />);
    // The template name "SHA Template" appears in both the subtitle and the metadata card
    const templateNames = screen.getAllByText('SHA Template');
    expect(templateNames.length).toBeGreaterThanOrEqual(1);
  });

  it('renders generatedAt when present', () => {
    setupDefaultMocks({ doc: mockGeneratedDoc });
    render(<DocumentDetailPage />);
    // The "Generated" label only appears in metadata when generatedAt is present
    // (separate from the status badge "Generated")
    expect(screen.getByText('Generated', { selector: 'span.text-sm.text-gray-500' })).toBeInTheDocument();
  });

  it('does not render generatedAt for draft documents', () => {
    render(<DocumentDetailPage />);
    // For drafts, the "Generated" label in metadata card should not appear
    // Only "Draft" status badge should be present, not a "Generated" date row
    const generatedLabels = screen.queryAllByText('Generated');
    // generatedLabels should be empty since there's no generatedAt and no GENERATED status
    expect(generatedLabels.length).toBe(0);
  });

  // ─── Form data card ──────────────────────────────────────────────────

  it('renders form data card with key/value pairs', () => {
    render(<DocumentDetailPage />);
    expect(screen.getByText('Form Data')).toBeInTheDocument();
    expect(screen.getByText('partyName')).toBeInTheDocument();
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('amount')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('does not render form data card when formData is empty', () => {
    const docWithEmptyFormData = { ...mockDraftDoc, formData: {} };
    setupDefaultMocks({ doc: docWithEmptyFormData });
    render(<DocumentDetailPage />);
    expect(screen.queryByText('Form Data')).not.toBeInTheDocument();
  });

  it('does not render form data card when formData is null', () => {
    const docWithNullFormData = { ...mockDraftDoc, formData: null };
    setupDefaultMocks({ doc: docWithNullFormData });
    render(<DocumentDetailPage />);
    expect(screen.queryByText('Form Data')).not.toBeInTheDocument();
  });

  // ─── Content hash ────────────────────────────────────────────────────

  it('renders content hash when present (truncated)', () => {
    setupDefaultMocks({ doc: mockGeneratedDoc });
    render(<DocumentDetailPage />);
    expect(screen.getByText('Content Hash')).toBeInTheDocument();
    // The hash is truncated: first 16 chars + "..."
    expect(screen.getByText('abc123def4567890...')).toBeInTheDocument();
  });

  it('does not render content hash when null', () => {
    render(<DocumentDetailPage />);
    expect(screen.queryByText('Content Hash')).not.toBeInTheDocument();
  });

  it('does not render blockchain hash when null', () => {
    render(<DocumentDetailPage />);
    expect(screen.queryByText('Blockchain Hash')).not.toBeInTheDocument();
  });

  it('renders blockchain hash when present', () => {
    const docWithBlockchain = {
      ...mockGeneratedDoc,
      blockchainTxHash: '0xabcdef1234567890abcdef1234567890',
    };
    setupDefaultMocks({ doc: docWithBlockchain });
    render(<DocumentDetailPage />);
    expect(screen.getByText('Blockchain Hash')).toBeInTheDocument();
    expect(screen.getByText('0xabcdef12345678...')).toBeInTheDocument();
  });

  // ─── Preview area ────────────────────────────────────────────────────

  it('shows "Preview not available" for draft documents', () => {
    render(<DocumentDetailPage />);
    expect(screen.getByText('Preview not available for this document.')).toBeInTheDocument();
  });

  it('shows preview HTML for generated documents', () => {
    setupDefaultMocks({
      doc: mockGeneratedDoc,
      previewHtml: '<h1>Meeting Minutes Preview</h1>',
    });
    render(<DocumentDetailPage />);
    expect(screen.getByText('Meeting Minutes Preview')).toBeInTheDocument();
  });

  it('shows "Preview not available" when generated doc has no preview HTML', () => {
    setupDefaultMocks({
      doc: mockGeneratedDoc,
      previewHtml: null,
      previewLoading: false,
    });
    render(<DocumentDetailPage />);
    expect(screen.getByText('Preview not available for this document.')).toBeInTheDocument();
  });

  it('preview loading state shows spinner', () => {
    setupDefaultMocks({
      doc: mockGeneratedDoc,
      previewLoading: true,
    });
    const { container } = render(<DocumentDetailPage />);
    // The spinner uses Loader2 with animate-spin class
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // ─── Loading, error, not found, no company ───────────────────────────

  it('shows loading skeleton when document is loading', () => {
    setupDefaultMocks({ isLoading: true });
    const { container } = render(<DocumentDetailPage />);
    // The skeleton has animate-pulse class
    const pulse = container.querySelector('.animate-pulse');
    expect(pulse).toBeInTheDocument();
  });

  it('shows loading skeleton when company is loading', () => {
    setupDefaultMocks({ companyLoading: true });
    const { container } = render(<DocumentDetailPage />);
    const pulse = container.querySelector('.animate-pulse');
    expect(pulse).toBeInTheDocument();
  });

  it('shows error state', () => {
    setupDefaultMocks({ error: new Error('Failed to load') });
    render(<DocumentDetailPage />);
    expect(screen.getByText('An error occurred loading this document.')).toBeInTheDocument();
    // Should still show back link
    expect(screen.getByText('Back to Documents')).toBeInTheDocument();
  });

  it('shows not found state when doc is null', () => {
    setupDefaultMocks({ doc: null });
    render(<DocumentDetailPage />);
    expect(screen.getByText('Document not found.')).toBeInTheDocument();
    expect(
      screen.getByText('The document you are looking for does not exist.'),
    ).toBeInTheDocument();
    // Should still show back link
    expect(screen.getByText('Back to Documents')).toBeInTheDocument();
  });

  it('shows no-company state', () => {
    setupDefaultMocks({ company: null });
    render(<DocumentDetailPage />);
    expect(screen.getByText('No documents found')).toBeInTheDocument();
  });

  // ─── Locale display ──────────────────────────────────────────────────

  it('locale displays correctly for pt-BR', () => {
    render(<DocumentDetailPage />);
    expect(screen.getByText('Portugu\u00eas (BR)')).toBeInTheDocument();
  });

  it('locale displays correctly for en', () => {
    setupDefaultMocks({ doc: mockGeneratedDoc });
    render(<DocumentDetailPage />);
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  // ─── Delete flow ─────────────────────────────────────────────────────

  it('clicking Delete opens confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<DocumentDetailPage />);

    // Dialog should not be visible initially
    expect(screen.queryByText('Delete Document')).not.toBeInTheDocument();

    await user.click(screen.getByText('Delete'));

    expect(screen.getByText('Delete Document')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete this document?'),
    ).toBeInTheDocument();
  });

  it('clicking confirm in delete dialog calls deleteMutation.mutateAsync', async () => {
    const user = userEvent.setup();
    const mockDeleteAsync = jest.fn().mockResolvedValue({});
    mockUseDeleteDocument.mockReturnValue({
      mutateAsync: mockDeleteAsync,
      isPending: false,
    });
    render(<DocumentDetailPage />);

    await user.click(screen.getByText('Delete'));
    // The confirm button in the dialog has the text from deleteDialog.confirm
    const confirmButtons = screen.getAllByText('Delete');
    // The second "Delete" is the confirm button inside the dialog
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    await user.click(confirmButton);

    expect(mockDeleteAsync).toHaveBeenCalledWith('doc-123');
  });

  it('successful delete shows success toast and redirects to /dashboard/documents', async () => {
    const user = userEvent.setup();
    const mockDeleteAsync = jest.fn().mockResolvedValue({});
    mockUseDeleteDocument.mockReturnValue({
      mutateAsync: mockDeleteAsync,
      isPending: false,
    });
    render(<DocumentDetailPage />);

    await user.click(screen.getByText('Delete'));
    const confirmButtons = screen.getAllByText('Delete');
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Document deleted successfully.');
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/documents');
  });

  it('failed delete shows error and does not redirect', async () => {
    const user = userEvent.setup();
    const deleteError = new Error('Delete failed');
    const mockDeleteAsync = jest.fn().mockRejectedValue(deleteError);
    mockUseDeleteDocument.mockReturnValue({
      mutateAsync: mockDeleteAsync,
      isPending: false,
    });
    render(<DocumentDetailPage />);

    await user.click(screen.getByText('Delete'));
    const confirmButtons = screen.getAllByText('Delete');
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(deleteError);
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('cancel button in delete dialog closes the dialog', async () => {
    const user = userEvent.setup();
    render(<DocumentDetailPage />);

    await user.click(screen.getByText('Delete'));
    expect(screen.getByText('Delete Document')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete Document')).not.toBeInTheDocument();
  });

  // ─── Generate flow ───────────────────────────────────────────────────

  it('clicking Generate PDF calls generateMutation.mutateAsync', async () => {
    const user = userEvent.setup();
    const mockGenerateAsync = jest.fn().mockResolvedValue({});
    mockUseGenerateFromDraft.mockReturnValue({
      mutateAsync: mockGenerateAsync,
      isPending: false,
    });
    render(<DocumentDetailPage />);

    // Click the first Generate PDF button (header action button)
    const generateButtons = screen.getAllByText('Generate PDF');
    await user.click(generateButtons[0]);

    expect(mockGenerateAsync).toHaveBeenCalledWith('doc-123');
  });

  it('successful generate shows success toast', async () => {
    const user = userEvent.setup();
    const mockGenerateAsync = jest.fn().mockResolvedValue({});
    mockUseGenerateFromDraft.mockReturnValue({
      mutateAsync: mockGenerateAsync,
      isPending: false,
    });
    render(<DocumentDetailPage />);

    const generateButtons = screen.getAllByText('Generate PDF');
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Document generated successfully.');
    });
  });

  it('failed generate shows error toast', async () => {
    const user = userEvent.setup();
    const generateError = new Error('Generate failed');
    const mockGenerateAsync = jest.fn().mockRejectedValue(generateError);
    mockUseGenerateFromDraft.mockReturnValue({
      mutateAsync: mockGenerateAsync,
      isPending: false,
    });
    render(<DocumentDetailPage />);

    const generateButtons = screen.getAllByText('Generate PDF');
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(generateError);
    });
  });

  it('shows generating state when mutation is pending', () => {
    mockUseGenerateFromDraft.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: true,
    });
    render(<DocumentDetailPage />);
    expect(screen.getAllByText('Generating...').length).toBeGreaterThanOrEqual(1);
  });

  // ─── Download flow ───────────────────────────────────────────────────

  it('clicking Download PDF fetches download URL and opens it', async () => {
    const user = userEvent.setup();
    const mockWindowOpen = jest.fn();
    const originalOpen = window.open;
    window.open = mockWindowOpen;

    const mockRefetch = jest.fn().mockResolvedValue({
      data: { url: 'https://s3.example.com/file.pdf' },
    });
    mockUseDocumentDownloadUrl.mockReturnValue({ refetch: mockRefetch });
    setupDefaultMocks({ doc: mockGeneratedDoc });
    // Re-apply download mock after setupDefaultMocks
    mockUseDocumentDownloadUrl.mockReturnValue({ refetch: mockRefetch });

    render(<DocumentDetailPage />);

    await user.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith('https://s3.example.com/file.pdf', '_blank');
    });

    window.open = originalOpen;
  });

  it('shows error toast when download URL is missing', async () => {
    const user = userEvent.setup();
    const mockRefetch = jest.fn().mockResolvedValue({ data: null });
    setupDefaultMocks({ doc: mockGeneratedDoc });
    mockUseDocumentDownloadUrl.mockReturnValue({ refetch: mockRefetch });

    render(<DocumentDetailPage />);

    await user.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to get download link.');
    });
  });

  // ─── Preview title ───────────────────────────────────────────────────

  it('renders Document Preview heading', () => {
    render(<DocumentDetailPage />);
    expect(screen.getByText('Document Preview')).toBeInTheDocument();
  });

  // ─── Dates formatted in pt-BR ────────────────────────────────────────

  it('renders created and updated dates', () => {
    render(<DocumentDetailPage />);
    // The page uses Intl.DateTimeFormat('pt-BR') which formats dates as DD/MM/YYYY HH:MM
    // Verify the date labels are present
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });
});
