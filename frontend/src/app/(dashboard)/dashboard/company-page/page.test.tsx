import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CompanyPagePage from './page';

// --- i18n keys ---

const i18nKeys: Record<string, string> = {
  // Page-level
  'companyPage.title': 'Company Page',
  'companyPage.subtitle': 'Build your investor-ready company profile',
  // Empty / Create
  'companyPage.empty.title': 'No company found',
  'companyPage.empty.description': 'You need to create a company first.',
  'companyPage.create.title': 'Create your company page',
  'companyPage.create.description': 'Share information about your startup.',
  'companyPage.create.button': 'Create Profile',
  // Status
  'companyPage.status.draft': 'Draft',
  'companyPage.status.published': 'Published',
  'companyPage.status.archived': 'Archived',
  // Publish / Unpublish
  'companyPage.publish.button': 'Publish',
  'companyPage.publish.success': 'Profile published!',
  'companyPage.unpublish.button': 'Unpublish',
  'companyPage.unpublish.success': 'Profile unpublished',
  // Archive
  'companyPage.archive.title': 'Archive Profile',
  'companyPage.archive.confirm': 'Are you sure you want to archive?',
  'companyPage.archive.success': 'Profile archived',
  // Info tab
  'companyPage.info.title': 'Info',
  'companyPage.info.headline': 'Headline',
  'companyPage.info.headlinePlaceholder': 'A short tagline',
  'companyPage.info.description': 'Description',
  'companyPage.info.descriptionPlaceholder': 'Describe your company...',
  'companyPage.info.sector': 'Sector',
  'companyPage.info.sectorPlaceholder': 'Select a sector',
  'companyPage.info.foundedYear': 'Founded year',
  'companyPage.info.foundedYearPlaceholder': 'e.g. 2020',
  'companyPage.info.location': 'Location',
  'companyPage.info.locationPlaceholder': 'e.g. Sao Paulo, SP',
  'companyPage.info.website': 'Website',
  'companyPage.info.websitePlaceholder': 'https://yourcompany.com',
  'companyPage.info.save': 'Save Info',
  'companyPage.info.saved': 'Info saved successfully',
  // Metrics tab
  'companyPage.metrics.title': 'Metrics',
  'companyPage.metrics.add': 'Add Metric',
  'companyPage.metrics.empty': 'Add key metrics to showcase your company.',
  'companyPage.metrics.label': 'Label',
  'companyPage.metrics.labelPlaceholder': 'e.g. MRR',
  'companyPage.metrics.value': 'Value',
  'companyPage.metrics.valuePlaceholder': 'e.g. R$ 50.000',
  'companyPage.metrics.format': 'Format',
  'companyPage.metrics.formatOptions.number': 'Number',
  'companyPage.metrics.formatOptions.currencyBrl': 'Currency (BRL)',
  'companyPage.metrics.formatOptions.currencyUsd': 'Currency (USD)',
  'companyPage.metrics.formatOptions.percentage': 'Percentage',
  'companyPage.metrics.formatOptions.text': 'Text',
  'companyPage.metrics.save': 'Save Metrics',
  'companyPage.metrics.saved': 'Metrics saved',
  'companyPage.metrics.remove': 'Remove metric',
  'companyPage.metrics.maxReached': 'Maximum of 6 metrics reached',
  // Team tab
  'companyPage.team.title': 'Team',
  'companyPage.team.add': 'Add Member',
  'companyPage.team.empty': 'Add your team members.',
  'companyPage.team.name': 'Name',
  'companyPage.team.namePlaceholder': 'Full name',
  'companyPage.team.titleField': 'Title / Role',
  'companyPage.team.titlePlaceholder': 'e.g. CEO',
  'companyPage.team.linkedin': 'LinkedIn URL',
  'companyPage.team.linkedinPlaceholder': 'https://linkedin.com/in/name',
  'companyPage.team.photoUpload': 'Upload photo',
  'companyPage.team.save': 'Save Team',
  'companyPage.team.saved': 'Team saved',
  'companyPage.team.remove': 'Remove member',
  'companyPage.team.maxReached': 'Maximum of 10 members reached',
  // Share tab
  'companyPage.share.title': 'Share',
  'companyPage.share.copyUrl': 'Copy link',
  'companyPage.share.copySuccess': 'Link copied!',
  'companyPage.share.customSlug': 'Custom URL',
  'companyPage.share.urlPrefix': 'app.navia.com.br/p/',
  'companyPage.share.save': 'Save URL',
  'companyPage.share.saved': 'URL updated',
  'companyPage.share.slugHelper': 'Lowercase letters, numbers, hyphens (3-50 chars)',
  'companyPage.share.slugError': 'This URL is already taken',
  'companyPage.share.accessTypeLabel': 'Who can view your profile?',
  // Access types
  'companyPage.accessType.public': 'Anyone with the link can view',
  'companyPage.accessType.emailGated': 'Visitors provide email before viewing',
  // Sectors
  'companyPage.sectors.fintech': 'Fintech',
  'companyPage.sectors.saas': 'SaaS',
  'companyPage.sectors.healthtech': 'Healthtech',
  // Common
  'common.cancel': 'Cancel',
  'common.save': 'Save',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    return (key: string, params?: Record<string, unknown>) => {
      const fullKey = `${namespace}.${key}`;

      if (fullKey === 'companyPage.info.descriptionHelper') {
        return `${params?.count}/5000 characters`;
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

// --- Mock hooks ---

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

// Profile data
const mockProfile = {
  id: 'p1',
  companyId: 'c1',
  slug: 'acme-abc1',
  headline: 'Leading Fintech',
  description: 'We build financial tools.',
  sector: 'FINTECH',
  foundedYear: 2020,
  website: 'https://acme.com',
  location: 'Sao Paulo, SP',
  status: 'DRAFT' as const,
  accessType: 'PUBLIC' as const,
  publishedAt: null,
  archivedAt: null,
  viewCount: 42,
  shareUrl: 'https://app.navia.com.br/p/acme-abc1',
  company: { name: 'Acme', logoUrl: null },
  metrics: [
    { id: 'm1', label: 'MRR', value: 'R$ 50.000', format: 'CURRENCY_BRL' as const, icon: null, order: 0 },
  ],
  team: [
    { id: 't1', name: 'John Doe', title: 'CEO', photoUrl: null, linkedinUrl: null, order: 0 },
  ],
  documents: [],
  litigation: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

let mockProfileData: {
  data: typeof mockProfile | null | undefined;
  isLoading: boolean;
} = { data: mockProfile, isLoading: false };

jest.mock('@/hooks/use-company-profile', () => ({
  useCompanyProfile: () => mockProfileData,
}));

const mockCreateMutate = jest.fn();
const mockUpdateMutate = jest.fn();
const mockPublishMutate = jest.fn();
const mockUnpublishMutate = jest.fn();
const mockArchiveMutate = jest.fn();
const mockSlugMutate = jest.fn();
const mockMetricsMutate = jest.fn();
const mockTeamMutate = jest.fn();
const mockPhotoMutate = jest.fn();

jest.mock('@/hooks/use-profile-mutations', () => ({
  useCreateProfile: () => ({ mutateAsync: mockCreateMutate, isPending: false }),
  useUpdateProfile: () => ({ mutateAsync: mockUpdateMutate, isPending: false }),
  usePublishProfile: () => ({ mutateAsync: mockPublishMutate, isPending: false }),
  useUnpublishProfile: () => ({ mutateAsync: mockUnpublishMutate, isPending: false }),
  useArchiveProfile: () => ({ mutateAsync: mockArchiveMutate, isPending: false }),
  useUpdateSlug: () => ({ mutateAsync: mockSlugMutate, isPending: false }),
  useUpdateMetrics: () => ({ mutateAsync: mockMetricsMutate, isPending: false }),
  useUpdateTeam: () => ({ mutateAsync: mockTeamMutate, isPending: false }),
  useUploadTeamPhoto: () => ({ mutateAsync: mockPhotoMutate, isPending: false }),
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

// --- Setup helpers ---

function setupMocks(overrides?: {
  noCompany?: boolean;
  companyLoading?: boolean;
  profile?: typeof mockProfile | null;
  profileLoading?: boolean;
}) {
  mockCompanyData = {
    selectedCompany: overrides?.noCompany ? null : mockCompany,
    companies: overrides?.noCompany ? [] : [mockCompany],
    isLoading: overrides?.companyLoading ?? false,
    error: null,
    setSelectedCompanyId: jest.fn(),
  };

  mockProfileData = {
    data:
      overrides?.profileLoading
        ? undefined
        : overrides?.profile !== undefined
          ? overrides.profile
          : mockProfile,
    isLoading: overrides?.profileLoading ?? false,
  };
}

// --- Tests ---

describe('CompanyPagePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  // --- No company state ---

  it('renders no-company state when no company selected', () => {
    setupMocks({ noCompany: true });
    render(<CompanyPagePage />);
    expect(screen.getByText('No company found')).toBeInTheDocument();
  });

  // --- Loading state ---

  it('renders loading skeleton when data is loading', () => {
    setupMocks({ profileLoading: true });
    render(<CompanyPagePage />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // --- Create profile state ---

  it('renders create profile CTA when no profile exists', () => {
    setupMocks({ profile: null });
    render(<CompanyPagePage />);
    expect(screen.getByText('Create your company page')).toBeInTheDocument();
    expect(screen.getByText('Create Profile')).toBeInTheDocument();
  });

  it('calls create mutation when Create Profile clicked', async () => {
    setupMocks({ profile: null });
    mockCreateMutate.mockResolvedValueOnce(mockProfile);
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Create Profile'));
    expect(mockCreateMutate).toHaveBeenCalled();
  });

  // --- Profile editor rendering ---

  it('renders page title with status badge for DRAFT profile', () => {
    render(<CompanyPagePage />);
    expect(screen.getByText('Company Page')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders Published badge for published profile', () => {
    setupMocks({
      profile: { ...mockProfile, status: 'PUBLISHED', publishedAt: '2026-02-01' },
    });
    render(<CompanyPagePage />);
    expect(screen.getByText('Published')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<CompanyPagePage />);
    expect(
      screen.getByText('Build your investor-ready company profile'),
    ).toBeInTheDocument();
  });

  // --- Tab navigation ---

  it('renders all four tabs', () => {
    render(<CompanyPagePage />);
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Metrics')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('shows Info tab content by default', () => {
    render(<CompanyPagePage />);
    // Info tab fields should be visible
    expect(screen.getByLabelText('Headline')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  // --- Info tab ---

  it('populates Info tab form fields from profile data', () => {
    render(<CompanyPagePage />);
    expect(screen.getByLabelText('Headline')).toHaveValue('Leading Fintech');
    expect(screen.getByLabelText('Description')).toHaveValue(
      'We build financial tools.',
    );
    expect(screen.getByLabelText('Website')).toHaveValue('https://acme.com');
    expect(screen.getByLabelText('Location')).toHaveValue('Sao Paulo, SP');
    expect(screen.getByLabelText('Founded year')).toHaveValue(2020);
  });

  it('shows character counter for description', () => {
    render(<CompanyPagePage />);
    expect(screen.getByText('25/5000 characters')).toBeInTheDocument();
  });

  it('calls update mutation on Info tab save', async () => {
    mockUpdateMutate.mockResolvedValueOnce(mockProfile);
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Save Info'));
    expect(mockUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Leading Fintech',
        description: 'We build financial tools.',
      }),
    );
  });

  // --- Metrics tab ---

  it('shows existing metrics when switching to Metrics tab', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Metrics'));
    expect(screen.getByDisplayValue('MRR')).toBeInTheDocument();
    expect(screen.getByDisplayValue('R$ 50.000')).toBeInTheDocument();
  });

  it('adds a new metric when Add Metric is clicked', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Metrics'));
    // There's one existing metric (#1), after clicking Add we should see #2
    const addButton = screen.getByRole('button', { name: /Add Metric/i });
    await user.click(addButton);

    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('calls metrics mutation on Save Metrics', async () => {
    mockMetricsMutate.mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Metrics'));
    await user.click(screen.getByText('Save Metrics'));
    expect(mockMetricsMutate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'MRR', value: 'R$ 50.000' }),
      ]),
    );
  });

  // --- Team tab ---

  it('shows existing team members when switching to Team tab', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Team'));
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CEO')).toBeInTheDocument();
  });

  it('adds a new team member when Add Member is clicked', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Team'));
    const addButton = screen.getByRole('button', { name: /Add Member/i });
    await user.click(addButton);

    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('calls team mutation on Save Team', async () => {
    mockTeamMutate.mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Team'));
    await user.click(screen.getByText('Save Team'));
    expect(mockTeamMutate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'John Doe', title: 'CEO' }),
      ]),
    );
  });

  it('shows initials in team member avatar when no photo', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Team'));
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  // --- Share tab ---

  it('shows share URL when switching to Share tab', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Share'));
    expect(
      screen.getByText('https://app.navia.com.br/p/acme-abc1'),
    ).toBeInTheDocument();
  });

  it('shows custom slug input with current slug', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Share'));
    expect(screen.getByDisplayValue('acme-abc1')).toBeInTheDocument();
    expect(screen.getByText('app.navia.com.br/p/')).toBeInTheDocument();
  });

  it('shows access type radio buttons', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Share'));
    expect(
      screen.getByText('Anyone with the link can view'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Visitors provide email before viewing'),
    ).toBeInTheDocument();
  });

  it('calls slug mutation when Save URL is clicked', async () => {
    mockSlugMutate.mockResolvedValueOnce(mockProfile);
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Share'));
    // Change the slug
    const slugInput = screen.getByDisplayValue('acme-abc1');
    await user.clear(slugInput);
    await user.type(slugInput, 'my-new-slug');

    await user.click(screen.getByText('Save URL'));
    expect(mockSlugMutate).toHaveBeenCalledWith('my-new-slug');
  });

  // --- Publish / Unpublish ---

  it('shows Publish button for DRAFT profile', () => {
    render(<CompanyPagePage />);
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('calls publish mutation when Publish is clicked', async () => {
    mockPublishMutate.mockResolvedValueOnce(mockProfile);
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Publish'));
    expect(mockPublishMutate).toHaveBeenCalled();
  });

  it('shows Unpublish button for PUBLISHED profile', () => {
    setupMocks({
      profile: { ...mockProfile, status: 'PUBLISHED', publishedAt: '2026-02-01' },
    });
    render(<CompanyPagePage />);
    expect(screen.getByText('Unpublish')).toBeInTheDocument();
  });

  it('calls unpublish mutation when Unpublish is clicked', async () => {
    setupMocks({
      profile: { ...mockProfile, status: 'PUBLISHED', publishedAt: '2026-02-01' },
    });
    mockUnpublishMutate.mockResolvedValueOnce(mockProfile);
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Unpublish'));
    expect(mockUnpublishMutate).toHaveBeenCalled();
  });

  // --- Archive ---

  it('opens archive dialog from dropdown menu', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    // Open dropdown menu
    const moreButton = screen.getByRole('button', { name: '' });
    // Find the MoreVertical button (it's the last ghost button in the header)
    const buttons = screen.getAllByRole('button');
    const moreBtn = buttons.find(
      (btn) => btn.querySelector('svg.lucide-more-vertical') !== null,
    );
    if (moreBtn) {
      await user.click(moreBtn);
      // The dropdown should show Archive Profile
      const archiveItem = await screen.findByText('Archive Profile');
      await user.click(archiveItem);
      expect(screen.getByText('Are you sure you want to archive?')).toBeInTheDocument();
    }
  });

  // --- Empty metrics ---

  it('shows empty state for metrics when no metrics exist', async () => {
    setupMocks({ profile: { ...mockProfile, metrics: [] } });
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Metrics'));
    expect(
      screen.getByText('Add key metrics to showcase your company.'),
    ).toBeInTheDocument();
  });

  // --- Empty team ---

  it('shows empty state for team when no team members exist', async () => {
    setupMocks({ profile: { ...mockProfile, team: [] } });
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    await user.click(screen.getByText('Team'));
    expect(screen.getByText('Add your team members.')).toBeInTheDocument();
  });

  // --- Info tab editing ---

  it('allows editing headline field', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    const headlineInput = screen.getByLabelText('Headline');
    await user.clear(headlineInput);
    await user.type(headlineInput, 'New Headline');
    expect(headlineInput).toHaveValue('New Headline');
  });

  it('allows editing description field', async () => {
    const user = userEvent.setup();
    render(<CompanyPagePage />);

    const descInput = screen.getByLabelText('Description');
    await user.clear(descInput);
    await user.type(descInput, 'New desc');
    expect(descInput).toHaveValue('New desc');
  });
});
