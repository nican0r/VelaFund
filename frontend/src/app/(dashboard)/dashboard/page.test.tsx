import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from './page';

// --- Mocks ---

// All i18n keys, keyed by full namespace.key path
const i18nKeys: Record<string, string> = {
  'dashboard.noCompany.title': 'No company found',
  'dashboard.noCompany.description': 'Create a company to get started.',
  'dashboard.welcomeGeneric': 'Welcome!',
  'dashboard.description': 'Your company at a glance.',
  'dashboard.stats.companyStatus': 'Company Status',
  'dashboard.stats.teamMembers': 'Team Members',
  'dashboard.stats.unread': 'Unread',
  'dashboard.stats.profileViews': 'Profile Views',
  'dashboard.statuses.ACTIVE': 'Active',
  'dashboard.statuses.DRAFT': 'Draft',
  'dashboard.statuses.INACTIVE': 'Inactive',
  'dashboard.statuses.DISSOLVED': 'Dissolved',
  'dashboard.completeness.title': 'Profile Completeness',
  'dashboard.completeness.complete': 'Profile is complete!',
  'dashboard.completeness.items.profile': 'Create profile',
  'dashboard.completeness.items.description': 'Add description',
  'dashboard.completeness.items.logo': 'Upload logo',
  'dashboard.completeness.items.metrics': 'Add metrics',
  'dashboard.completeness.items.team': 'Add team members',
  'dashboard.completeness.items.documents': 'Upload documents',
  'dashboard.completeness.items.kyc': 'Complete KYC',
  'dashboard.completeness.items.publish': 'Publish profile',
  'dashboard.health.title': 'Company Health',
  'dashboard.health.companyStatus': 'Company Status',
  'dashboard.health.cnpj': 'CNPJ Validation',
  'dashboard.health.cnpjValidated': 'Validated',
  'dashboard.health.cnpjPending': 'Pending validation',
  'dashboard.health.kyc': 'KYC Verification',
  'dashboard.health.kycApproved': 'Approved',
  'dashboard.health.kycPending': 'Pending verification',
  'dashboard.health.kycRejected': 'Rejected',
  'dashboard.quickActions.title': 'Quick Actions',
  'dashboard.quickActions.editProfile': 'Edit company page',
  'dashboard.quickActions.uploadDocument': 'Upload document',
  'dashboard.quickActions.inviteMember': 'Invite team member',
  'dashboard.quickActions.viewSettings': 'View settings',
  'dashboard.recentActivity.title': 'Recent Activity',
  'dashboard.recentActivity.viewAll': 'View all',
  'dashboard.recentActivity.empty': 'No activity yet',
  'dashboard.recentActivity.emptyDescription':
    'Activity will appear here as you use the platform.',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    return (key: string, params?: Record<string, unknown>) => {
      const fullKey = `${namespace}.${key}`;

      // Handle parameterized keys
      if (fullKey === 'dashboard.welcome' && params?.firstName) {
        return `Welcome, ${params.firstName}!`;
      }
      if (fullKey === 'dashboard.completeness.percent' && params?.value !== undefined) {
        return `${params.value}%`;
      }

      return i18nKeys[fullKey] ?? key;
    };
  },
}));

// Mock next/link as a simple anchor
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

// Mock auth context
const mockUseAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock company context
const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

// Mock profile hook
const mockUseCompanyProfile = jest.fn();
jest.mock('@/hooks/use-company-profile', () => ({
  useCompanyProfile: (...args: unknown[]) => mockUseCompanyProfile(...args),
}));

// Mock notifications hooks
const mockUseUnreadCount = jest.fn();
const mockUseNotifications = jest.fn();
jest.mock('@/hooks/use-notifications', () => ({
  useUnreadCount: () => mockUseUnreadCount(),
  useNotifications: (...args: unknown[]) => mockUseNotifications(...args),
}));

// --- Helpers ---

const defaultUser = {
  id: 'u1',
  privyUserId: 'privy-1',
  email: 'nelson@test.com',
  firstName: 'Nelson',
  lastName: 'Pereira',
  walletAddress: '0x123',
  kycStatus: 'PENDING',
  locale: 'pt-BR',
};

const defaultCompany = {
  id: 'c1',
  name: 'Acme Ltda.',
  status: 'ACTIVE',
  memberCount: 5,
};

const defaultProfile = {
  id: 'p1',
  companyId: 'c1',
  slug: 'acme',
  headline: 'Acme is great',
  description: 'We build things.',
  sector: 'Technology',
  foundedYear: 2020,
  website: 'https://acme.com',
  location: 'São Paulo',
  status: 'DRAFT' as const,
  accessType: 'PUBLIC' as const,
  publishedAt: null,
  archivedAt: null,
  viewCount: 42,
  shareUrl: 'https://app.navia.com.br/p/acme',
  company: { logoUrl: 'https://s3.amazonaws.com/logo.png' },
  metrics: [{ id: 'm1', label: 'MRR', value: 'R$ 50k', format: 'CURRENCY', icon: null, order: 0 }],
  team: [{ id: 't1', name: 'Nelson', title: 'CEO', photoUrl: null, linkedinUrl: null, order: 0 }],
  documents: [{ id: 'd1', profileId: 'p1', name: 'Pitch Deck.pdf', category: 'PITCH_DECK' as const, fileKey: 'profiles/p1/documents/d1.pdf', fileSize: 1024, mimeType: 'application/pdf', pageCount: 10, thumbnailKey: null, order: 0, uploadedById: 'u1', uploadedAt: '2026-01-01', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
  litigation: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-15',
};

function setupMocks(overrides?: {
  user?: Partial<typeof defaultUser> | null;
  company?: Partial<typeof defaultCompany> | null;
  companyLoading?: boolean;
  profile?: Partial<typeof defaultProfile> | null;
  profileLoading?: boolean;
  unreadCount?: number;
  notifications?: Array<{
    id: string;
    subject: string;
    read: boolean;
    createdAt: string;
  }>;
}) {
  const user =
    overrides?.user === null
      ? null
      : { ...defaultUser, ...(overrides?.user ?? {}) };
  const company =
    overrides?.company === null
      ? null
      : { ...defaultCompany, ...(overrides?.company ?? {}) };
  const profile =
    overrides?.profile === null
      ? null
      : { ...defaultProfile, ...(overrides?.profile ?? {}) };

  mockUseAuth.mockReturnValue({ user });
  mockUseCompany.mockReturnValue({
    selectedCompany: company,
    isLoading: overrides?.companyLoading ?? false,
  });
  mockUseCompanyProfile.mockReturnValue({
    data: profile,
    isLoading: overrides?.profileLoading ?? false,
  });
  mockUseUnreadCount.mockReturnValue({
    data: { count: overrides?.unreadCount ?? 3 },
  });
  mockUseNotifications.mockReturnValue({
    data: {
      data: overrides?.notifications ?? [],
    },
  });
}

// --- Tests ---

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Empty / No Company State ---

  describe('no-company state', () => {
    it('renders no-company state when user has no companies', () => {
      setupMocks({ company: null });

      render(<DashboardPage />);

      expect(screen.getByText('No company found')).toBeInTheDocument();
      expect(
        screen.getByText('Create a company to get started.'),
      ).toBeInTheDocument();
    });

    it('does not render stat cards when no company', () => {
      setupMocks({ company: null });

      render(<DashboardPage />);

      expect(screen.queryByText('Team Members')).not.toBeInTheDocument();
      expect(screen.queryByText('Profile Views')).not.toBeInTheDocument();
    });
  });

  // --- Loading State ---

  describe('loading state', () => {
    it('shows loading skeletons when company is loading', () => {
      setupMocks({ companyLoading: true });

      render(<DashboardPage />);

      const pulsingElements = document.querySelectorAll('.animate-pulse');
      expect(pulsingElements.length).toBeGreaterThan(0);
    });

    it('shows loading skeletons when profile is loading', () => {
      setupMocks({ profileLoading: true, profile: null });

      render(<DashboardPage />);

      const pulsingElements = document.querySelectorAll('.animate-pulse');
      expect(pulsingElements.length).toBeGreaterThan(0);
    });
  });

  // --- Welcome Header ---

  describe('welcome header', () => {
    it('shows personalized welcome when user has firstName', () => {
      setupMocks({ user: { firstName: 'Nelson' } });

      render(<DashboardPage />);

      expect(screen.getByText('Welcome, Nelson!')).toBeInTheDocument();
    });

    it('shows generic welcome when user has no firstName', () => {
      setupMocks({ user: { firstName: null } });

      render(<DashboardPage />);

      expect(screen.getByText('Welcome!')).toBeInTheDocument();
    });

    it('shows the description subtitle', () => {
      setupMocks({});

      render(<DashboardPage />);

      expect(
        screen.getByText('Your company at a glance.'),
      ).toBeInTheDocument();
    });
  });

  // --- Stat Cards ---

  describe('stat cards', () => {
    it('renders all 4 stat card labels', () => {
      setupMocks({});

      render(<DashboardPage />);

      expect(screen.getAllByText('Company Status')).toHaveLength(2); // stat card + health card
      expect(screen.getByText('Team Members')).toBeInTheDocument();
      expect(screen.getByText('Unread')).toBeInTheDocument();
      expect(screen.getByText('Profile Views')).toBeInTheDocument();
    });

    it('shows company status value from selected company', () => {
      setupMocks({ company: { status: 'ACTIVE' } });

      render(<DashboardPage />);

      // "Active" appears in both stat card and health card
      const activeElements = screen.getAllByText('Active');
      expect(activeElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows DRAFT status correctly', () => {
      setupMocks({ company: { status: 'DRAFT' } });

      render(<DashboardPage />);

      // "Draft" appears in both stat card and health card
      const draftElements = screen.getAllByText('Draft');
      expect(draftElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows team member count from company', () => {
      setupMocks({ company: { memberCount: 12 } });

      render(<DashboardPage />);

      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('shows unread notification count', () => {
      setupMocks({ unreadCount: 7 });

      render(<DashboardPage />);

      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('shows profile view count', () => {
      setupMocks({ profile: { viewCount: 42 } });

      render(<DashboardPage />);

      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('shows 0 for profile views when no profile', () => {
      setupMocks({ profile: null });

      render(<DashboardPage />);

      // "0" appears for profile views (and possibly team members if 0)
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(1);
    });

    it('shows dash for status when company has no status', () => {
      setupMocks({ company: { status: undefined as unknown as string } });

      render(<DashboardPage />);

      // Multiple dashes may appear (stat card + health card)
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Profile Completeness ---

  describe('completeness card', () => {
    it('renders profile completeness title and percentage', () => {
      setupMocks({});

      render(<DashboardPage />);

      expect(screen.getByText('Profile Completeness')).toBeInTheDocument();
      // With the default profile (has everything except publish + KYC), percentage is 75%
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('renders progress bar with correct ARIA attributes', () => {
      setupMocks({});

      render(<DashboardPage />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('shows incomplete items as checklist', () => {
      // With null profile, all 8 items are incomplete
      setupMocks({ profile: null, user: { kycStatus: 'PENDING' } });

      render(<DashboardPage />);

      // Should show first 4 of 8 incomplete items
      expect(screen.getByText('Create profile')).toBeInTheDocument();
      expect(screen.getByText('Add description')).toBeInTheDocument();
      expect(screen.getByText('Upload logo')).toBeInTheDocument();
      expect(screen.getByText('Add metrics')).toBeInTheDocument();
    });

    it('shows "+X more" when more than 4 incomplete items', () => {
      setupMocks({ profile: null, user: { kycStatus: 'PENDING' } });

      render(<DashboardPage />);

      // 8 incomplete - 4 shown = "+4 more"
      expect(screen.getByText('+4 more')).toBeInTheDocument();
    });

    it('shows complete message when all items done', () => {
      setupMocks({
        profile: {
          status: 'PUBLISHED' as const,
          description: 'Full description',
          company: { logoUrl: 'https://logo.png' },
          metrics: [{ id: 'm1', label: 'MRR', value: '50k', format: 'CURRENCY', icon: null, order: 0 }],
          team: [{ id: 't1', name: 'Nelson', title: 'CEO', photoUrl: null, linkedinUrl: null, order: 0 }],
          documents: [{ id: 'd1', profileId: 'p1', name: 'Deck.pdf', category: 'PITCH_DECK' as const, fileKey: 'profiles/p1/documents/d1.pdf', fileSize: 1024, mimeType: 'application/pdf', pageCount: null, thumbnailKey: null, order: 0, uploadedById: 'u1', uploadedAt: '2026-01-01', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
        },
        user: { kycStatus: 'APPROVED' },
      });

      render(<DashboardPage />);

      expect(screen.getByText('Profile is complete!')).toBeInTheDocument();
    });

    it('computes partial completeness correctly', () => {
      // Profile exists with description but nothing else
      setupMocks({
        profile: {
          description: 'We build stuff',
          company: { logoUrl: null },
          metrics: [],
          team: [],
          documents: [],
          status: 'DRAFT' as const,
        },
        user: { kycStatus: 'PENDING' },
      });

      render(<DashboardPage />);

      // 2 of 8 done (profile exists + description) = 25%
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });

  // --- Health Card ---

  describe('health card', () => {
    it('renders company health title', () => {
      setupMocks({});

      render(<DashboardPage />);

      expect(screen.getByText('Company Health')).toBeInTheDocument();
    });

    it('shows CNPJ validation label', () => {
      setupMocks({});

      render(<DashboardPage />);

      expect(screen.getByText('CNPJ Validation')).toBeInTheDocument();
      expect(screen.getByText('Pending validation')).toBeInTheDocument();
    });

    it('shows KYC verification label and pending status', () => {
      setupMocks({ user: { kycStatus: 'PENDING' } });

      render(<DashboardPage />);

      expect(screen.getByText('KYC Verification')).toBeInTheDocument();
      expect(screen.getByText('Pending verification')).toBeInTheDocument();
    });

    it('shows KYC as approved when kycStatus is APPROVED', () => {
      setupMocks({ user: { kycStatus: 'APPROVED' } });

      render(<DashboardPage />);

      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('shows KYC as rejected when kycStatus is REJECTED', () => {
      setupMocks({ user: { kycStatus: 'REJECTED' } });

      render(<DashboardPage />);

      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });
  });

  // --- Quick Actions ---

  describe('quick actions', () => {
    it('renders quick actions section with all 4 links', () => {
      setupMocks({});

      render(<DashboardPage />);

      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Edit company page')).toBeInTheDocument();
      expect(screen.getByText('Upload document')).toBeInTheDocument();
      expect(screen.getByText('Invite team member')).toBeInTheDocument();
      expect(screen.getByText('View settings')).toBeInTheDocument();
    });

    it('links to correct pages', () => {
      setupMocks({});

      render(<DashboardPage />);

      const editLink = screen.getByText('Edit company page').closest('a');
      expect(editLink).toHaveAttribute('href', '/dashboard/company-page');

      const uploadLink = screen.getByText('Upload document').closest('a');
      expect(uploadLink).toHaveAttribute('href', '/dashboard/dataroom');

      const inviteLink = screen.getByText('Invite team member').closest('a');
      expect(inviteLink).toHaveAttribute('href', '/dashboard/settings');

      const settingsLink = screen.getByText('View settings').closest('a');
      expect(settingsLink).toHaveAttribute('href', '/dashboard/settings');
    });
  });

  // --- Recent Activity ---

  describe('recent activity', () => {
    it('renders recent activity section title', () => {
      setupMocks({});

      render(<DashboardPage />);

      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    it('shows empty state when no notifications', () => {
      setupMocks({ notifications: [] });

      render(<DashboardPage />);

      expect(screen.getByText('No activity yet')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Activity will appear here as you use the platform.',
        ),
      ).toBeInTheDocument();
    });

    it('does not show "View all" link when no notifications', () => {
      setupMocks({ notifications: [] });

      render(<DashboardPage />);

      expect(screen.queryByText('View all')).not.toBeInTheDocument();
    });

    it('shows notifications when available', () => {
      setupMocks({
        notifications: [
          {
            id: 'n1',
            subject: 'New member joined',
            read: false,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'n2',
            subject: 'Document uploaded',
            read: true,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
      });

      render(<DashboardPage />);

      expect(screen.getByText('New member joined')).toBeInTheDocument();
      expect(screen.getByText('Document uploaded')).toBeInTheDocument();
    });

    it('shows "View all" link pointing to notifications page', () => {
      setupMocks({
        notifications: [
          {
            id: 'n1',
            subject: 'Test notification',
            read: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      render(<DashboardPage />);

      const viewAllLink = screen.getByText('View all').closest('a');
      expect(viewAllLink).toHaveAttribute('href', '/dashboard/notifications');
    });

    it('shows relative time for notifications', () => {
      setupMocks({
        notifications: [
          {
            id: 'n1',
            subject: 'Just now event',
            read: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      render(<DashboardPage />);

      expect(screen.getByText('now')).toBeInTheDocument();
    });

    it('shows hours-ago time format', () => {
      setupMocks({
        notifications: [
          {
            id: 'n1',
            subject: 'Hours ago event',
            read: true,
            createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
          },
        ],
      });

      render(<DashboardPage />);

      expect(screen.getByText('2h')).toBeInTheDocument();
    });

    it('shows days-ago time format', () => {
      setupMocks({
        notifications: [
          {
            id: 'n1',
            subject: 'Days ago event',
            read: true,
            createdAt: new Date(
              Date.now() - 3 * 24 * 3600000,
            ).toISOString(),
          },
        ],
      });

      render(<DashboardPage />);

      expect(screen.getByText('3d')).toBeInTheDocument();
    });
  });

  // --- Hook Integration ---

  describe('hook integration', () => {
    it('passes companyId to useCompanyProfile', () => {
      setupMocks({ company: { id: 'company-xyz' } });

      render(<DashboardPage />);

      expect(mockUseCompanyProfile).toHaveBeenCalledWith('company-xyz');
    });

    it('passes undefined to useCompanyProfile when no company', () => {
      setupMocks({ company: null });

      render(<DashboardPage />);

      expect(mockUseCompanyProfile).toHaveBeenCalledWith(undefined);
    });

    it('calls useNotifications with limit 5 and sort', () => {
      setupMocks({});

      render(<DashboardPage />);

      expect(mockUseNotifications).toHaveBeenCalledWith({
        limit: 5,
        sort: '-createdAt',
      });
    });
  });
});
