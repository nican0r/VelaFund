import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import NewDocumentPage from '../page';

// --- Translation mock ---

const translations: Record<string, string> = {
  empty: 'No documents found',
  'wizard.title': 'New Document',
  'wizard.step1': 'Select Template',
  'wizard.step2': 'Fill Details',
  'wizard.selectTemplate': 'Choose a document template',
  'wizard.selectTemplateDescription':
    'Select the type of document you want to create.',
  'wizard.noTemplates': 'No templates available',
  'wizard.formTitle': 'Document Title',
  'wizard.formTitlePlaceholder': 'e.g. Shareholder Agreement',
  'wizard.saveDraft': 'Save Draft',
  'wizard.saving': 'Saving...',
  'wizard.generatePdf': 'Generate PDF',
  'wizard.generating': 'Generating document...',
  'wizard.back': 'Back',
  'wizard.preview': 'Document Preview',
  'wizard.previewEmpty': 'Fill in the fields to see a preview.',
  'wizard.draftSuccess': 'Draft saved successfully.',
  'wizard.generateSuccess': 'Document generated successfully.',
  'wizard.formFields': 'Form Fields',
  'detail.back': 'Back to Documents',
  'type.SHAREHOLDER_AGREEMENT': 'Shareholder Agreement',
  'type.MEETING_MINUTES': 'Meeting Minutes',
  'type.SHARE_CERTIFICATE': 'Share Certificate',
  'type.OPTION_LETTER': 'Option Letter',
  'type.INVESTMENT_AGREEMENT': 'Investment Agreement',
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

// --- Next/Navigation mock ---

const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// --- Sonner toast mock ---

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// --- Company context mock ---

const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

// --- Hook mocks ---

const mockUseDocumentTemplates = jest.fn();
const mockUseDocumentTemplate = jest.fn();
const mockCreateMutateAsync = jest.fn();
const mockDraftMutateAsync = jest.fn();
const mockUseCreateDocument = jest.fn();
const mockUseCreateDraft = jest.fn();

jest.mock('@/hooks/use-documents', () => ({
  useDocumentTemplates: (...args: unknown[]) =>
    mockUseDocumentTemplates(...args),
  useDocumentTemplate: (...args: unknown[]) =>
    mockUseDocumentTemplate(...args),
  useCreateDocument: (...args: unknown[]) => mockUseCreateDocument(...args),
  useCreateDraft: (...args: unknown[]) => mockUseCreateDraft(...args),
}));

// --- Error toast mock ---

const mockShowError = jest.fn();
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => ({ showError: mockShowError }),
}));

// --- Mock data ---

const mockCompany = { id: 'c1', name: 'Acme Ltda.', status: 'ACTIVE' };

const mockTemplates = [
  {
    id: 'tpl-1',
    companyId: 'c1',
    name: 'SHA Template',
    documentType: 'SHAREHOLDER_AGREEMENT',
    content: '',
    formSchema: null,
    version: 1,
    isActive: true,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'tpl-2',
    companyId: 'c1',
    name: 'Minutes Template',
    documentType: 'MEETING_MINUTES',
    content: '',
    formSchema: {
      fields: [
        { name: 'date', label: 'Meeting Date', type: 'date', required: true },
        { name: 'attendees', label: 'Attendees', type: 'text' },
      ],
    },
    version: 1,
    isActive: true,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

// --- Setup helper ---

function setup() {
  mockUseCompany.mockReturnValue({
    selectedCompany: mockCompany,
    isLoading: false,
  });

  mockUseDocumentTemplates.mockReturnValue({
    data: {
      data: mockTemplates,
      meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
    },
    isLoading: false,
  });

  mockUseDocumentTemplate.mockReturnValue({
    data: null,
  });

  mockUseCreateDocument.mockReturnValue({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  });

  mockUseCreateDraft.mockReturnValue({
    mutateAsync: mockDraftMutateAsync,
    isPending: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setup();
});

// --- Tests ---

describe('NewDocumentPage', () => {
  // --- 1. Page title ---

  it('renders page title "New Document"', () => {
    render(<NewDocumentPage />);
    expect(screen.getByText('New Document')).toBeInTheDocument();
  });

  // --- 2. Back link ---

  it('renders back link to /dashboard/documents', () => {
    render(<NewDocumentPage />);
    const backLink = screen.getByText('Back to Documents');
    expect(backLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/documents',
    );
  });

  // --- 3. Step indicators ---

  it('renders step indicators (step 1 and step 2)', () => {
    render(<NewDocumentPage />);
    expect(screen.getByText('Select Template')).toBeInTheDocument();
    expect(screen.getByText('Fill Details')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  // --- 4. Template selection grid ---

  it('renders template selection grid in step 1', () => {
    render(<NewDocumentPage />);
    expect(
      screen.getByText('Choose a document template'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Select the type of document you want to create.'),
    ).toBeInTheDocument();
  });

  // --- 5. Template names and type labels ---

  it('renders template names and document type labels', () => {
    render(<NewDocumentPage />);
    expect(screen.getByText('SHA Template')).toBeInTheDocument();
    expect(screen.getByText('Minutes Template')).toBeInTheDocument();
    expect(screen.getByText('Shareholder Agreement')).toBeInTheDocument();
    expect(screen.getByText('Meeting Minutes')).toBeInTheDocument();
  });

  // --- 6. Loading skeleton ---

  it('shows loading skeleton when templates are loading', () => {
    mockUseDocumentTemplates.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    render(<NewDocumentPage />);
    // Loading skeleton renders animated divs
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  // --- 7. Empty templates ---

  it('shows "No templates available" when empty', () => {
    mockUseDocumentTemplates.mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } },
      isLoading: false,
    });
    render(<NewDocumentPage />);
    expect(screen.getByText('No templates available')).toBeInTheDocument();
  });

  // --- 8. Clicking template advances to step 2 ---

  it('clicking template card advances to step 2', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));
    // Step 2 content should appear
    expect(screen.getByText('Form Fields')).toBeInTheDocument();
    expect(screen.getByText('Document Preview')).toBeInTheDocument();
  });

  // --- 9. Step 2 shows form fields title ---

  it('step 2 shows form fields heading', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));
    expect(screen.getByText('Form Fields')).toBeInTheDocument();
  });

  // --- 10. Step 2 shows Document Title input ---

  it('step 2 shows Document Title input', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));
    expect(screen.getByText('Document Title')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. Shareholder Agreement'),
    ).toBeInTheDocument();
  });

  // --- 11. Dynamic form fields from template schema ---

  it('step 2 shows dynamic form fields from template schema', async () => {
    // Select template tpl-2 which has formSchema with date and text fields
    mockUseDocumentTemplate.mockReturnValue({
      data: mockTemplates[1],
    });

    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('Minutes Template'));

    expect(screen.getByText('Meeting Date')).toBeInTheDocument();
    expect(screen.getByText('Attendees')).toBeInTheDocument();
  });

  // --- 12. Step 2 shows preview panel ---

  it('step 2 shows preview panel', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));
    expect(screen.getByText('Document Preview')).toBeInTheDocument();
  });

  // --- 13. Title appears in preview when typed ---

  it('title appears in preview when typed', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'My Agreement');

    // The title should appear in the preview area (as an h3)
    const previewTitle = screen.getByText('My Agreement');
    expect(previewTitle).toBeInTheDocument();
  });

  // --- 14. Preview shows placeholder when title is empty ---

  it('preview shows placeholder when title is empty', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));
    expect(
      screen.getByText('Fill in the fields to see a preview.'),
    ).toBeInTheDocument();
  });

  // --- 15. Save Draft button disabled when title is empty ---

  it('Save Draft button is disabled when title is empty', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    const saveDraftButton = screen.getByText('Save Draft');
    expect(saveDraftButton).toBeDisabled();
  });

  // --- 16. Generate PDF button disabled when title is empty ---

  it('Generate PDF button is disabled when title is empty', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    const generateButton = screen.getByText('Generate PDF');
    expect(generateButton).toBeDisabled();
  });

  // --- 17. Back button returns to step 1 ---

  it('clicking Back in step 2 returns to step 1', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));
    expect(screen.getByText('Form Fields')).toBeInTheDocument();

    await user.click(screen.getByText('Back'));
    expect(
      screen.getByText('Choose a document template'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Form Fields')).not.toBeInTheDocument();
  });

  // --- 18. Clicking Save Draft calls draftMutation.mutateAsync ---

  it('clicking Save Draft calls draftMutation.mutateAsync', async () => {
    mockDraftMutateAsync.mockResolvedValue({ id: 'doc-new' });
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'Test Draft');

    await user.click(screen.getByText('Save Draft'));

    await waitFor(() => {
      expect(mockDraftMutateAsync).toHaveBeenCalledWith({
        templateId: 'tpl-1',
        title: 'Test Draft',
        formData: {},
      });
    });
  });

  // --- 19. Clicking Generate PDF calls createMutation.mutateAsync ---

  it('clicking Generate PDF calls createMutation.mutateAsync', async () => {
    mockCreateMutateAsync.mockResolvedValue({ id: 'doc-gen' });
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'Generated Doc');

    await user.click(screen.getByText('Generate PDF'));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        templateId: 'tpl-1',
        title: 'Generated Doc',
        formData: {},
      });
    });
  });

  // --- 20. Successful draft save redirects to document detail page ---

  it('successful draft save shows toast and redirects to document detail page', async () => {
    mockDraftMutateAsync.mockResolvedValue({ id: 'doc-42' });
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'My Draft');

    await user.click(screen.getByText('Save Draft'));

    const { toast } = require('sonner');
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Draft saved successfully.',
      );
      expect(mockRouterPush).toHaveBeenCalledWith(
        '/dashboard/documents/doc-42',
      );
    });
  });

  // --- 21. No-company state ---

  it('shows no-company state when selectedCompany is null', () => {
    mockUseCompany.mockReturnValue({
      selectedCompany: null,
      isLoading: false,
    });
    render(<NewDocumentPage />);
    expect(screen.getByText('No documents found')).toBeInTheDocument();
    expect(screen.queryByText('New Document')).not.toBeInTheDocument();
  });

  // --- Additional tests for thoroughness ---

  it('successful generate shows toast and redirects to document detail page', async () => {
    mockCreateMutateAsync.mockResolvedValue({ id: 'doc-99' });
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'My Generated Doc');

    await user.click(screen.getByText('Generate PDF'));

    const { toast } = require('sonner');
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Document generated successfully.',
      );
      expect(mockRouterPush).toHaveBeenCalledWith(
        '/dashboard/documents/doc-99',
      );
    });
  });

  it('shows error toast when draft save fails', async () => {
    const error = new Error('Server error');
    mockDraftMutateAsync.mockRejectedValue(error);
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'Failing Draft');

    await user.click(screen.getByText('Save Draft'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(error);
    });
  });

  it('shows error toast when generate fails', async () => {
    const error = new Error('Generation failed');
    mockCreateMutateAsync.mockRejectedValue(error);
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'Failing Generate');

    await user.click(screen.getByText('Generate PDF'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(error);
    });
  });

  it('shows "Saving..." text when draft mutation is pending', async () => {
    mockUseCreateDraft.mockReturnValue({
      mutateAsync: mockDraftMutateAsync,
      isPending: true,
    });
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows "Generating document..." text when create mutation is pending', async () => {
    mockUseCreateDocument.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: true,
    });
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    expect(screen.getByText('Generating document...')).toBeInTheDocument();
  });

  it('disables Back button when saving is in progress', async () => {
    mockUseCreateDraft.mockReturnValue({
      mutateAsync: mockDraftMutateAsync,
      isPending: true,
    });
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    const backButton = screen.getByText('Back');
    expect(backButton).toBeDisabled();
  });

  it('buttons become enabled when title is entered', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    expect(screen.getByText('Save Draft')).toBeDisabled();
    expect(screen.getByText('Generate PDF')).toBeDisabled();

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'Some Title');

    expect(screen.getByText('Save Draft')).not.toBeDisabled();
    expect(screen.getByText('Generate PDF')).not.toBeDisabled();
  });

  it('passes formData with field values to draft mutation', async () => {
    // Use template with form schema
    mockUseDocumentTemplate.mockReturnValue({
      data: mockTemplates[1],
    });
    mockDraftMutateAsync.mockResolvedValue({ id: 'doc-form' });
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('Minutes Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'Board Meeting');

    // Fill in the attendees text field (label is not associated via htmlFor,
    // so find the input as the sibling of the label text)
    const attendeesLabel = screen.getByText('Attendees');
    const attendeesInput = attendeesLabel
      .closest('div')!
      .querySelector('input')!;
    await user.type(attendeesInput, 'Alice, Bob');

    await user.click(screen.getByText('Save Draft'));

    await waitFor(() => {
      expect(mockDraftMutateAsync).toHaveBeenCalledWith({
        templateId: 'tpl-2',
        title: 'Board Meeting',
        formData: { attendees: 'Alice, Bob' },
      });
    });
  });

  it('resets title and form data when selecting a different template', async () => {
    // First, make template detail return schema for tpl-2
    mockUseDocumentTemplate.mockReturnValue({
      data: mockTemplates[1],
    });
    const user = userEvent.setup();
    render(<NewDocumentPage />);

    // Select first template
    await user.click(screen.getByText('SHA Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'Old Title');

    // Go back to step 1
    await user.click(screen.getByText('Back'));

    // Select second template
    await user.click(screen.getByText('Minutes Template'));

    // Title should be reset
    const newTitleInput = screen.getByPlaceholderText(
      'e.g. Shareholder Agreement',
    );
    expect(newTitleInput).toHaveValue('');
  });

  it('preview shows field placeholders for unfilled dynamic fields', async () => {
    mockUseDocumentTemplate.mockReturnValue({
      data: mockTemplates[1],
    });
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('Minutes Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'My Meeting');

    // Dynamic fields show label with placeholder {{fieldName}} when empty
    expect(screen.getByText('Meeting Date:')).toBeInTheDocument();
    expect(screen.getByText('{{date}}')).toBeInTheDocument();
    expect(screen.getByText('Attendees:')).toBeInTheDocument();
    expect(screen.getByText('{{attendees}}')).toBeInTheDocument();
  });

  it('preview shows actual field values when dynamic fields are filled', async () => {
    mockUseDocumentTemplate.mockReturnValue({
      data: mockTemplates[1],
    });
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('Minutes Template'));

    const titleInput = screen.getByPlaceholderText('e.g. Shareholder Agreement');
    await user.type(titleInput, 'My Meeting');

    const attendeesLabel = screen.getByText('Attendees:');
    // "Attendees" also appears as a form label; find the input via its parent
    const formLabels = screen.getAllByText('Attendees');
    const attendeesFormLabel = formLabels.find(
      (el) => el.tagName === 'LABEL',
    )!;
    const attendeesInput = attendeesFormLabel
      .closest('div')!
      .querySelector('input')!;
    await user.type(attendeesInput, 'Alice, Bob');

    // The filled value should appear in preview instead of placeholder
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
    expect(screen.queryByText('{{attendees}}')).not.toBeInTheDocument();
  });

  it('does not render step 2 content on initial load', () => {
    render(<NewDocumentPage />);
    expect(screen.queryByText('Form Fields')).not.toBeInTheDocument();
    expect(screen.queryByText('Document Preview')).not.toBeInTheDocument();
  });

  it('does not render step 1 content when in step 2', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    expect(
      screen.queryByText('Choose a document template'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('SHA Template')).not.toBeInTheDocument();
  });

  it('passes companyId to useDocumentTemplates hook', () => {
    render(<NewDocumentPage />);
    expect(mockUseDocumentTemplates).toHaveBeenCalledWith('c1', {
      limit: 100,
    });
  });

  it('required marker shown on Document Title label', async () => {
    const user = userEvent.setup();
    render(<NewDocumentPage />);
    await user.click(screen.getByText('SHA Template'));

    // The label contains "Document Title" and a red asterisk
    const labels = document.querySelectorAll('.text-red-500');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });
});
